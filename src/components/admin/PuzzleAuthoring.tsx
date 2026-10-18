import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import {
	renderAuthoredHexPuzzle,
	type AuthoredHexPuzzle,
	type AuthoringPalette,
} from '../../puzzles/hexAuthoring'
import { HEX_PUZZLE_RECIPES } from '../../puzzles/hexPuzzle'
import type { Database } from '../../types/database'
import {
	generateDraftPreview,
	puzzleDraftArgs,
	savePuzzleDraft,
	type DraftArgs,
	type PuzzleUsage,
} from '../../services/puzzleDrafts'
import PuzzleMode from '../puzzle/PuzzleMode'
import styles from './AdminPortal.module.css'
import PuzzleDraftLibrary from './PuzzleDraftLibrary'
import useUnsavedDraft, { confirmDiscardDraft } from './useUnsavedDraft'
import { faSquareArrowLeft } from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import PuzzleDraftForm from './PuzzleDraftForm'
import { loadColorSchemes } from '../../services/colorSchemes'
import SchemeLibrary from './SchemeLibrary'

function messageFor(cause: unknown): string {
	return cause instanceof Error
		? cause.message
		: 'Unable to prepare the puzzle playtest.'
}

export default function PuzzleAuthoring({
	client,
	onDirtyChange,
}: {
	readonly client: SupabaseClient<Database>
	readonly onDirtyChange?: (dirty: boolean) => void
}) {
	const [palettes, setPalettes] = useState<readonly AuthoringPalette[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [reload, setReload] = useState(0)
	const [libraryRevision, setLibraryRevision] = useState(0)
	const [creating, setCreating] = useState(false)
	const [managingSchemes, setManagingSchemes] = useState(false)
	const [busy, setBusy] = useState(false)
	const working = useRef(false)
	const [draftName, setDraftName] = useState('')
	const [usage, setUsage] = useState<PuzzleUsage>('collection')
	const [recipeId, setRecipeId] = useState<string>(HEX_PUZZLE_RECIPES[0].id)
	const [saved, setSaved] = useState(false)
	const [savedName, setSavedName] = useState('')
	const [saveMessage, setSaveMessage] = useState('')
	const pendingSave = useRef<DraftArgs | null>(null)
	const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(
		null,
	)
	const previewedSeeds = useRef(new Map<string, Set<string>>())
	const [generated, setGenerated] = useState<{
		puzzle: AuthoredHexPuzzle
		run: number
	} | null>(null)
	const dirty =
		creating &&
		(saved
			? draftName !== savedName
			: !!generated || draftName.length > 0 || usage !== 'collection')
	useUnsavedDraft(dirty || busy, onDirtyChange)

	useEffect(() => {
		let active = true
		async function load() {
			try {
				const next = await loadColorSchemes(client)
				if (active) setPalettes(next)
			} catch (cause) {
				if (active) {
					setPalettes([])
					setError(messageFor(cause))
				}
			} finally {
				if (active) setLoading(false)
			}
		}
		void load()
		return () => {
			active = false
		}
	}, [client, reload])

	async function generate() {
		if (working.current) return
		working.current = true
		setBusy(true)
		setError('')
		const recipe = HEX_PUZZLE_RECIPES.find(value => value.id === recipeId)
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
			setError(messageFor(cause))
		} finally {
			working.current = false
			setBusy(false)
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
		setBusy(true)
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
			setSaved(true)
			setSavedName(draftName)
			setLibraryRevision(value => value + 1)
			setSaveMessage(
				`Saved "${args.p_name}" as an unpublished ${usage === 'daily' ? 'daily' : 'set/pack'} draft. Name, palette, and recipe choices now apply to the next randomization; this saved preview stays unchanged.`,
			)
		} catch (cause) {
			setError(messageFor(cause))
		} finally {
			working.current = false
			setBusy(false)
		}
	}

	const palette = palettes.find(
		value => value.id === generated?.puzzle.paletteId,
	)
	const selectedPalette =
		palettes.find(value => value.id === selectedPaletteId) ?? palettes[0]
	if (managingSchemes) {
		return (
			<SchemeLibrary
				client={client}
				onDirtyChange={onDirtyChange}
				onBack={() => {
					setManagingSchemes(false)
					setLoading(true)
					setError('')
					setReload(value => value + 1)
					setLibraryRevision(value => value + 1)
				}}
			/>
		)
	}
	if (!creating) {
		return (
			<>
				{error && <p role="alert">{error}</p>}
				{loading && <p role="status">Loading Supabase palettes...</p>}
				<PuzzleDraftLibrary
					client={client}
					palettes={palettes}
					revision={libraryRevision}
					onManagePalettes={() => setManagingSchemes(true)}
					onNew={() => {
						setGenerated(null)
						setRecipeId(HEX_PUZZLE_RECIPES[0].id)
						setSaved(false)
						setDraftName('')
						setSaveMessage('')
						setError('')
						pendingSave.current = null
						setCreating(true)
					}}
					onDirtyChange={onDirtyChange}
					onRefreshPalettes={() => {
						setLoading(true)
						setError('')
						setReload(value => value + 1)
					}}
					palettesLoading={loading}
				/>
			</>
		)
	}
	return (
		<>
			<section aria-labelledby="puzzle-authoring-title">
				<button
					type="button"
					className={styles.backLink}
					disabled={busy}
					onClick={() => {
						if (!dirty || confirmDiscardDraft()) setCreating(false)
					}}
				>
					<FontAwesomeIcon
						icon={faSquareArrowLeft}
						aria-hidden="true"
					/>{' '}
					Back to library
				</button>
				<h2 id="puzzle-authoring-title">New puzzle</h2>
				<p>
					Generate and playtest all six recipes, then save designs as
					unpublished drafts.
				</p>
				{error && <p role="alert">{error}</p>}
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
					onRefreshPalettes={() => {
						setLoading(true)
						setError('')
						setReload(value => value + 1)
					}}
					palettesLoading={loading}
					busy={busy}
					generation={{
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
						submitDisabled: loading || !generated || !palette,
					}}
					onSubmit={save}
				/>
				{generated && palette && (
					<div className={styles.playtest}>
						{saveMessage && <p role="status">{saveMessage}</p>}
						{generated.puzzle.recipe.rotation && (
							<p className={styles.rotationHelp}>
								Tap tray pieces to rotate; drag to place.
								Double-tap board pieces to return. Keyboard:
								Enter/Space rotates, activate a tile to place,
								Delete/Backspace returns.
							</p>
						)}
						<PuzzleMode
							key={generated.run}
							previewPuzzle={renderAuthoredHexPuzzle(
								generated.puzzle,
								palette,
							)}
						/>
					</div>
				)}
				{generated && !palette && !loading && (
					<p role="alert">
						The playtest palette is unavailable. Refresh palettes or
						generate a new playtest.
					</p>
				)}
			</section>
		</>
	)
}
