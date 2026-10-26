import type { SupabaseClient } from '@supabase/supabase-js'
import { useMemo, useRef, useState, type SubmitEvent } from 'react'
import {
	generateAuthoredPuzzle,
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
	managePuzzleGroup,
	type PuzzleGroup,
	puzzleDraftArgs,
	savePuzzleDraft,
	type DraftArgs,
	isPuzzleGroupPurpose,
	isPuzzleGroupTrack,
	recipesForTrack,
	previewedSeedKey,
} from '@/features/admin/services'
import PuzzlePlaytest from './PuzzlePlaytest'
import PuzzleDraftLibrary, { type LibraryView } from './PuzzleDraftLibrary'
import { useUnsavedDraft } from '@/ui/navigation'
import { DraftRecoveryNotice, useDraftRecovery } from '@/features/admin/drafts'
import PuzzleDraftForm from './PuzzleDraftForm'
import { useCatalog, useCatalogInvalidation } from '@/features/admin/catalog'
import { Button, Loading } from '@/ui/components'
import { errorMessage } from '@/features/admin/common'
import { compareGroupOrder, memberGroupOrderKey } from '@/features/admin/groups'

const fallbackError = 'Unable to prepare the puzzle playtest.'

// A generated preview is rebuilt from its seed, so the solution is never stored.
interface NewPuzzleSnapshot {
	readonly name: string
	readonly shape: PuzzleShapeId
	readonly recipeId: string
	readonly paletteId: string | null
	readonly previewSeed: string | null
	readonly previewPaletteId: string | null
	readonly group: PuzzleGroup['row'] | null
}

function parseNewPuzzleSnapshot(raw: unknown): NewPuzzleSnapshot | null {
	if (!raw || typeof raw !== 'object') return null
	const value = raw as Record<string, unknown>
	const optionalString = (field: unknown) =>
		field === null || typeof field === 'string'
	const group = value.group as Record<string, unknown> | null
	if (
		typeof value.name !== 'string' ||
		typeof value.shape !== 'string' ||
		!isPuzzleShapeId(value.shape) ||
		typeof value.recipeId !== 'string' ||
		!optionalString(value.paletteId) ||
		!optionalString(value.previewSeed) ||
		!optionalString(value.previewPaletteId) ||
		(group !== null &&
			(typeof group !== 'object' ||
				typeof group.id !== 'string' ||
				typeof group.name !== 'string'))
	)
		return null
	return {
		name: value.name,
		shape: value.shape,
		recipeId: value.recipeId,
		paletteId: value.paletteId as string | null,
		previewSeed: value.previewSeed as string | null,
		previewPaletteId: value.previewPaletteId as string | null,
		group: group as PuzzleGroup['row'] | null,
	}
}

export default function PuzzleAuthoring({
	client,
}: {
	readonly client: SupabaseClient<Database>
}) {
	const paletteCatalog = useCatalog('palettes', client)
	const paletteGroupCatalog = useCatalog('paletteGroups', client)
	const invalidate = useCatalogInvalidation()
	// Order like the palette library: by group and position, then unassigned by name.
	// Without group data (still loading or failed), palettes stay alphabetical.
	const palettes: readonly AuthoringPalette[] = useMemo(() => {
		const groups = paletteGroupCatalog.data ?? []
		return [...(paletteCatalog.data ?? [])].sort((a, b) =>
			compareGroupOrder(
				memberGroupOrderKey(a, groups),
				memberGroupOrderKey(b, groups),
			),
		)
	}, [paletteCatalog.data, paletteGroupCatalog.data])
	const loading = paletteCatalog.loading || paletteGroupCatalog.loading
	const paletteError = paletteCatalog.error
		? errorMessage(paletteCatalog.error, fallbackError)
		: ''
	const [error, setError] = useState('')
	const [creating, setCreating] = useState(false)
	// A new puzzle made from a filtered group joins that group, taking its shape and track.
	const [targetGroup, setTargetGroup] = useState<PuzzleGroup | null>(null)
	// Filters in force when creation began, restored on return to the list.
	const [libraryView, setLibraryView] = useState<LibraryView>()
	const [pending, setPending] = useState<string | null>(null)
	const busy = pending !== null
	const working = useRef(false)
	const [draftName, setDraftName] = useState('')
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
		(saved ? draftName !== savedName : !!generated || draftName.length > 0)
	const recovery = useDraftRecovery<NewPuzzleSnapshot>({
		key: 'puzzle:new',
		// Once saved, the work is on the server and no longer at risk.
		dirty: dirty && !saved,
		snapshot: {
			name: draftName,
			shape,
			recipeId,
			paletteId: selectedPaletteId,
			previewSeed: generated?.puzzle.seed ?? null,
			previewPaletteId: generated?.puzzle.paletteId ?? null,
			group: targetGroup?.row ?? null,
		},
		parse: parseNewPuzzleSnapshot,
		onRestore: restored => {
			const group = restored.group
			const recipe = PUZZLE_RECIPES.find(
				value => value.id === restored.recipeId,
			)
			let puzzle: AuthoredPuzzle | null = null
			if (recipe && restored.previewSeed && restored.previewPaletteId) {
				try {
					puzzle = generateAuthoredPuzzle(
						restored.previewSeed,
						restored.previewPaletteId,
						recipe,
						restored.shape,
					)
				} catch {
					puzzle = null
				}
			}
			if (puzzle) {
				const key = previewedSeedKey(restored.shape, puzzle.recipe)
				const seeds = previewedSeeds.current.get(key) ?? new Set()
				seeds.add(puzzle.seed)
				previewedSeeds.current.set(key, seeds)
			}
			setTargetGroup(
				group && {
					row: group,
					purpose: isPuzzleGroupPurpose(group.purpose)
						? group.purpose
						: 'undecided',
					track:
						group.track && isPuzzleGroupTrack(group.track)
							? group.track
							: null,
					preview: null,
					members: [],
				},
			)
			setShape(restored.shape)
			setRecipeId(recipe?.id ?? PUZZLE_RECIPES[0].id)
			setSelectedPaletteId(restored.paletteId)
			setDraftName(restored.name)
			setGenerated(puzzle && { puzzle, run: 1 })
			setLibraryView(undefined)
			setSaved(false)
			setSaveMessage('')
			setError('')
			pendingSave.current = null
			setCreating(true)
		},
	})
	useUnsavedDraft({ dirty, pending: busy, discard: recovery.discard })

	function refreshPalettes() {
		setError('')
		void paletteCatalog.refresh().catch(() => {})
		void paletteGroupCatalog.refresh().catch(() => {})
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
				generated.puzzle,
			)
			// Retain the request ID after a failed response so retrying is idempotent.
			if (previous && JSON.stringify(previous) !== JSON.stringify(args)) {
				args.p_id = crypto.randomUUID()
			}
			pendingSave.current = args
			await savePuzzleDraft(client, args)
			if (targetGroup)
				await managePuzzleGroup(client, targetGroup.row.id, {
					kind: 'append',
					puzzleIds: [args.p_id],
				})
			setSaved(true)
			setSavedName(draftName)
			recovery.discard()
			invalidate('puzzleDrafts', 'puzzleGroups')
			setSaveMessage(
				`Saved "${args.p_name}" as an unpublished ${targetGroup ? `draft in "${targetGroup.row.name}"` : 'draft'}. Name, palette, and recipe choices now apply to the next randomization; this saved preview stays unchanged.`,
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
	if (!creating && recovery.pending) {
		return (
			<DraftRecoveryNotice recovery={recovery} subject="a new puzzle" />
		)
	}
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
					initialView={libraryView}
					onNew={(group, view) => {
						setLibraryView(view)
						setGenerated(null)
						setTargetGroup(group ?? null)
						setShape(
							group?.row.shape_id &&
								isPuzzleShapeId(group.row.shape_id)
								? group.row.shape_id
								: 'hexagon',
						)
						setRecipeId(recipesForTrack(group?.track ?? null)[0].id)
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
						paletteGroupCatalog.refreshing
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
				{targetGroup && (
					<p>
						This puzzle will be added to "{targetGroup.row.name}".
					</p>
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
						paletteGroupCatalog.refreshing
					}
					palettesError={!!paletteError}
					busy={busy}
					generation={{
						shape,
						// A group with a shape fixes it; daily groups leave it open.
						onShapeChange: targetGroup?.row.shape_id
							? undefined
							: setShape,
						recipes: recipesForTrack(targetGroup?.track ?? null),
						recipeId,
						onRecipeChange: setRecipeId,
						onGenerate: () => {
							void generate()
						},
					}}
					metadata={{
						name: draftName,
						onNameChange: setDraftName,
						locked: saved,
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
