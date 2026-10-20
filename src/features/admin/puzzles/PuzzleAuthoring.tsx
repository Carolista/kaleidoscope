import type { SupabaseClient } from '@supabase/supabase-js'
import { useMemo, useRef, useState, type SubmitEvent } from 'react'
import {
	renderAuthoredPuzzle,
	type AuthoredPuzzle,
	type AuthoringPalette,
	isPuzzleShapeId,
	PUZZLE_RECIPES,
	type PuzzleShapeId,
} from '@/domain/puzzles'
import type { Database } from '@/lib/supabase'
import {
	generateDraftPreview,
	manageDraftSet,
	type DraftSet,
	puzzleDraftArgs,
	savePuzzleDraft,
	type DraftArgs,
	type PuzzleUsage,
} from '@/features/admin/services'
import PuzzlePlaytest from './PuzzlePlaytest'
import PuzzleDraftLibrary, { type LibraryView } from './PuzzleDraftLibrary'
import { useUnsavedDraft } from '@/ui/navigation'
import PuzzleDraftForm from './PuzzleDraftForm'
import { useCatalog, useCatalogInvalidation } from '@/features/admin/catalog'
import { Button, Loading } from '@/ui/components'
import { errorMessage } from '@/features/admin/common'
import { compareSetOrder, memberSetOrderKey } from '@/features/admin/sets'

const fallbackError = 'Unable to prepare the puzzle playtest.'

export default function PuzzleAuthoring({
	client,
	catalogStatus,
}: {
	readonly client: SupabaseClient<Database>
	readonly catalogStatus?: 'drafts' | 'assigned'
}) {
	const paletteCatalog = useCatalog('palettes', client)
	const paletteSetCatalog = useCatalog('paletteSets', client)
	const invalidate = useCatalogInvalidation()
	// Order like the palette library: by set and position, then unassigned by name.
	// Without set data (still loading or failed), palettes stay alphabetical.
	const palettes: readonly AuthoringPalette[] = useMemo(() => {
		const sets = paletteSetCatalog.data ?? []
		return [...(paletteCatalog.data ?? [])].sort((a, b) =>
			compareSetOrder(
				memberSetOrderKey(a, sets),
				memberSetOrderKey(b, sets),
			),
		)
	}, [paletteCatalog.data, paletteSetCatalog.data])
	const loading = paletteCatalog.loading || paletteSetCatalog.loading
	const paletteError = paletteCatalog.error
		? errorMessage(paletteCatalog.error, fallbackError)
		: ''
	const [error, setError] = useState('')
	const [creating, setCreating] = useState(false)
	// A new puzzle made from a filtered set joins that set and takes its shape.
	const [targetSet, setTargetSet] = useState<DraftSet | null>(null)
	// Filters in force when creation began, restored on return to the list.
	const [libraryView, setLibraryView] = useState<LibraryView>()
	const [pending, setPending] = useState<string | null>(null)
	const busy = pending !== null
	const working = useRef(false)
	const [draftName, setDraftName] = useState('')
	const [usage, setUsage] = useState<PuzzleUsage>('collection')
	const [shape, setShape] = useState<PuzzleShapeId>('hexagon')
	const [recipeId, setRecipeId] = useState<string>(PUZZLE_RECIPES[0].id)
	const [saved, setSaved] = useState(false)
	const [savedName, setSavedName] = useState('')
	const [saveMessage, setSaveMessage] = useState('')
	const pendingSave = useRef<DraftArgs | null>(null)
	const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(
		null,
	)
	const previewedSeeds = useRef(new Map<string, Set<string>>())
	const [generated, setGenerated] = useState<{
		puzzle: AuthoredPuzzle
		run: number
	} | null>(null)
	const dirty =
		creating &&
		(saved
			? draftName !== savedName
			: !!generated || draftName.length > 0 || usage !== 'collection')
	useUnsavedDraft({ dirty, pending: busy })

	function refreshPalettes() {
		setError('')
		void paletteCatalog.refresh().catch(() => {})
		void paletteSetCatalog.refresh().catch(() => {})
	}

	async function generate() {
		if (working.current) return
		working.current = true
		setPending('Generating puzzle preview…')
		setError('')
		const recipe = PUZZLE_RECIPES.find(value => value.id === recipeId)
		const palette =
			palettes.find(value => value.id === selectedPaletteId) ??
			palettes[0]
		try {
			if (!recipe || !palette)
				throw new Error(
					'Choose a recipe and palette before generating.',
				)
			const puzzle = await generateDraftPreview(
				client,
				recipe,
				palette.id,
				previewedSeeds.current,
				shape,
			)
			setSaved(false)
			setSaveMessage('')
			if (saved && draftName === savedName) setDraftName('')
			pendingSave.current = null
			setGenerated(previous => ({
				puzzle,
				run: (previous?.run ?? 0) + 1,
			}))
		} catch (cause) {
			setError(errorMessage(cause, fallbackError))
		} finally {
			working.current = false
			setPending(null)
		}
	}

	async function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		if (working.current || saved || !generated) return
		setError('')
		if (!draftName.trim()) {
			setError('Enter a name for the puzzle draft.')
			return
		}
		working.current = true
		setPending('Saving puzzle draft…')
		try {
			const previous = pendingSave.current
			const args = puzzleDraftArgs(
				previous?.p_id ?? crypto.randomUUID(),
				draftName,
				usage,
				generated.puzzle,
			)
			// Retain the request ID after a failed response so retrying is idempotent.
			if (previous && JSON.stringify(previous) !== JSON.stringify(args)) {
				args.p_id = crypto.randomUUID()
			}
			pendingSave.current = args
			await savePuzzleDraft(client, args)
			if (targetSet)
				await manageDraftSet(client, targetSet.row.id, {
					kind: 'append',
					puzzleIds: [args.p_id],
				})
			setSaved(true)
			setSavedName(draftName)
			invalidate('puzzleDrafts', 'puzzleSets')
			setSaveMessage(
				`Saved "${args.p_name}" as an unpublished ${targetSet ? `draft in "${targetSet.row.name}"` : `${usage === 'daily' ? 'daily' : 'set/pack'} draft`}. Name, palette, and recipe choices now apply to the next randomization; this saved preview stays unchanged.`,
			)
		} catch (cause) {
			setError(errorMessage(cause, fallbackError))
		} finally {
			working.current = false
			setPending(null)
		}
	}

	const palette = palettes.find(
		value => value.id === generated?.puzzle.paletteId,
	)
	const selectedPalette =
		palettes.find(value => value.id === selectedPaletteId) ?? palettes[0]
	if (!creating) {
		return (
			<>
				{error && <p role="alert">{error}</p>}
				{paletteError && (
					<p role="alert">
						{paletteError}{' '}
						<Button onClick={refreshPalettes}>
							Retry loading palettes
						</Button>
					</p>
				)}
				<PuzzleDraftLibrary
					client={client}
					palettes={palettes}
					catalogStatus={catalogStatus}
					initialView={libraryView}
					onNew={(set, view) => {
						setLibraryView(view)
						setGenerated(null)
						setTargetSet(set ?? null)
						setShape(
							set && isPuzzleShapeId(set.row.shape_id)
								? set.row.shape_id
								: 'hexagon',
						)
						setUsage('collection')
						setRecipeId(PUZZLE_RECIPES[0].id)
						setSaved(false)
						setDraftName('')
						setSaveMessage('')
						setError('')
						pendingSave.current = null
						setCreating(true)
					}}
					onRefreshPalettes={refreshPalettes}
					palettesLoading={loading}
					palettesRefreshing={
						paletteCatalog.refreshing ||
						paletteSetCatalog.refreshing
					}
					palettesError={!!paletteError}
				/>
			</>
		)
	}
	return (
		<>
			<section aria-labelledby="puzzle-authoring-title">
				<h2 id="puzzle-authoring-title">New puzzle</h2>
				{targetSet && (
					<p>This puzzle will be added to "{targetSet.row.name}".</p>
				)}
				{error && <p role="alert">{error}</p>}
				{paletteError && <p role="alert">{paletteError}</p>}
				<PuzzleDraftForm
					mode="create"
					palettes={palettes}
					paletteId={selectedPalette?.id}
					onPaletteChange={paletteId => {
						setSelectedPaletteId(paletteId)
						setGenerated(previous =>
							previous && !saved
								? {
										...previous,
										puzzle: {
											...previous.puzzle,
											paletteId,
										},
									}
								: previous,
						)
					}}
					onRefreshPalettes={refreshPalettes}
					palettesLoading={loading}
					palettesRefreshing={
						paletteCatalog.refreshing ||
						paletteSetCatalog.refreshing
					}
					palettesError={!!paletteError}
					busy={busy}
					generation={{
						shape,
						onShapeChange: targetSet ? undefined : setShape,
						recipeId,
						onRecipeChange: setRecipeId,
						onGenerate: () => {
							void generate()
						},
					}}
					metadata={{
						name: draftName,
						usage,
						onNameChange: setDraftName,
						onUsageChange: setUsage,
						locked: saved,
						assigned: !!targetSet,
						submitDisabled: loading || !generated || !palette,
					}}
					onSubmit={save}
					onCancel={() => setCreating(false)}
				/>
				{generated && palette && (
					<PuzzlePlaytest
						key={generated.run}
						puzzle={renderAuthoredPuzzle(generated.puzzle, palette)}
					>
						{saveMessage && <p role="status">{saveMessage}</p>}
					</PuzzlePlaytest>
				)}
				{generated && !palette && !loading && !paletteError && (
					<p role="alert">
						The playtest palette is unavailable. Refresh palettes or
						generate a new playtest.
					</p>
				)}
				{pending && <Loading label={pending} />}
			</section>
		</>
	)
}
