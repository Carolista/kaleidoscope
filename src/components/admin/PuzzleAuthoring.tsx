import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
	generateAuthoredHexPuzzle,
	renderAuthoredHexPuzzle,
	type AuthoredHexPuzzle,
	type AuthoringPalette,
} from '../../puzzles/hexAuthoring'
import { HEX_PUZZLE_RECIPES } from '../../puzzles/hexPuzzle'
import { createUnusedPuzzleSeed } from '../../puzzles/puzzleSeed'
import type { Database } from '../../types/database'
import {
	loadSavedPuzzleSeeds,
	puzzleDraftArgs,
	savePuzzleDraft,
	type DraftArgs,
	type PuzzleUsage,
} from '../../services/puzzleDrafts'
import paletteStyles from '../controls/color-schemes/SchemePicker.module.css'
import PuzzleMode from '../puzzle/PuzzleMode'
import styles from './AdminPortal.module.css'
import PuzzleDraftLibrary from './PuzzleDraftLibrary'
import useUnsavedDraft, { confirmDiscardDraft } from './useUnsavedDraft'

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
	const [busy, setBusy] = useState(false)
	const working = useRef(false)
	const [draftName, setDraftName] = useState('')
	const [usage, setUsage] = useState<PuzzleUsage>('collection')
	const [saved, setSaved] = useState(false)
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
	const dirty = creating && !!generated && !saved
	useUnsavedDraft(dirty || busy, onDirtyChange)

	useEffect(() => {
		let active = true
		async function load() {
			try {
				const { data, error } = await client
					.from('palettes')
					.select('id, name, colors')
					.order('name')
				if (error) throw new Error(error.message)
				if (!data)
					throw new Error('The palette catalog returned no data.')
				const next = data.map(row => {
					const [a, b, c, d, e] = row.colors
					if (
						row.colors.length !== 5 ||
						!a ||
						!b ||
						!c ||
						!d ||
						!e ||
						row.colors.some(color => !/^#[0-9a-f]{6}$/i.test(color))
					) {
						throw new Error(
							`Palette "${row.name}" must contain five six-digit hex colors.`,
						)
					}
					return {
						id: row.id,
						name: row.name,
						colors: [a, b, c, d, e] as const,
					}
				})
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

	async function generate(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (working.current) return
		working.current = true
		setBusy(true)
		setError('')
		const form = new FormData(event.currentTarget)
		const recipe = HEX_PUZZLE_RECIPES.find(
			value => value.id === form.get('recipe'),
		)
		const palette =
			palettes.find(value => value.id === selectedPaletteId) ??
			palettes[0]
		try {
			if (!recipe || !palette)
				throw new Error(
					'Choose a recipe and palette before generating.',
				)
			const recipeKey = `hexagon:${recipe.id}`
			const excluded = await loadSavedPuzzleSeeds(client, recipe)
			for (const seed of previewedSeeds.current.get(recipeKey) ?? []) {
				excluded.add(seed)
			}
			const seed = createUnusedPuzzleSeed(excluded)
			const puzzle = generateAuthoredHexPuzzle(seed, palette.id, recipe)
			const previewed =
				previewedSeeds.current.get(recipeKey) ?? new Set<string>()
			previewed.add(seed)
			previewedSeeds.current.set(recipeKey, previewed)
			setSaved(false)
			setSaveMessage('')
			setDraftName('')
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

	async function save(event: FormEvent<HTMLFormElement>) {
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
			setLibraryRevision(value => value + 1)
			setSaveMessage(
				`Saved "${args.p_name}" as an unpublished ${usage === 'daily' ? 'daily' : 'set/pack'} draft. Palette and recipe choices now apply to the next randomization; this saved preview stays unchanged.`,
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
	if (!creating) {
		return (
			<>
				{error && <p role="alert">{error}</p>}
				{loading && <p role="status">Loading Supabase palettes...</p>}
				<button
					type="button"
					disabled={loading}
					onClick={() => {
						setLoading(true)
						setError('')
						setReload(value => value + 1)
					}}
				>
					Refresh palettes
				</button>
				<PuzzleDraftLibrary
					client={client}
					palettes={palettes}
					revision={libraryRevision}
					onNew={() => {
						setGenerated(null)
						setSaved(false)
						setDraftName('')
						setSaveMessage('')
						setError('')
						pendingSave.current = null
						setCreating(true)
					}}
					onDirtyChange={onDirtyChange}
				/>
			</>
		)
	}
	return (
		<>
			<section aria-labelledby="puzzle-authoring-title">
				<button
					type="button"
					disabled={busy}
					onClick={() => {
						if (!dirty || confirmDiscardDraft()) setCreating(false)
					}}
				>
					Back to library
				</button>
				<h2 id="puzzle-authoring-title">New puzzle</h2>
				<p>
					Generate and playtest all six recipes, then save designs as
					unpublished drafts.
				</p>
				{error && <p role="alert">{error}</p>}
				<form onSubmit={generate} className={styles.authoringForm}>
					<div className={styles.paletteControls}>
						<button
							type="button"
							disabled={loading || busy}
							onClick={() => {
								setLoading(true)
								setError('')
								setReload(value => value + 1)
							}}
						>
							Refresh palettes
						</button>
						{loading ? (
							<p role="status">Loading Supabase palettes...</p>
						) : palettes.length === 0 ? (
							<p>
								No palettes available. Add a palette to the
								catalog before generating.
							</p>
						) : (
							<fieldset className={styles.palettePicker}>
								<legend>Palette</legend>
								<ul className={paletteStyles.list}>
									{palettes.map(palette => (
										<li key={palette.id}>
											<button
												type="button"
												disabled={busy}
												className={styles.paletteOption}
												aria-label={`Select the ${palette.name} color palette`}
												aria-pressed={
													selectedPalette?.id ===
													palette.id
												}
												onClick={() => {
													setSelectedPaletteId(
														palette.id,
													)
													setGenerated(previous =>
														previous && !saved
															? {
																	...previous,
																	puzzle: {
																		...previous.puzzle,
																		paletteId:
																			palette.id,
																	},
																}
															: previous,
													)
												}}
											>
												<span
													className={
														styles.paletteColors
													}
													aria-hidden="true"
												>
													{palette.colors.map(
														(color, index) => (
															<span
																key={index}
																className={
																	paletteStyles.swatch
																}
																style={{
																	backgroundColor:
																		color,
																}}
															/>
														),
													)}
												</span>
												<span>{palette.name}</span>
											</button>
										</li>
									))}
								</ul>
							</fieldset>
						)}
					</div>
					{!loading && palettes.length > 0 && (
						<div className={styles.recipeControls}>
							<label htmlFor="puzzle-recipe">Recipe</label>
							<select
								id="puzzle-recipe"
								name="recipe"
								disabled={busy}
							>
								{HEX_PUZZLE_RECIPES.map(recipe => (
									<option key={recipe.id} value={recipe.id}>
										{recipe.label}
									</option>
								))}
							</select>
							<button type="submit" disabled={busy}>
								Randomize puzzle
							</button>
						</div>
					)}
				</form>
				{generated && palette && (
					<div className={styles.playtest}>
						<form
							onSubmit={save}
							className={styles.metadataForm}
							aria-label="Save puzzle draft"
						>
							<div className={styles.metadataField}>
								<label htmlFor="draft-name">Puzzle name</label>
								<input
									id="draft-name"
									value={draftName}
									required
									disabled={busy || saved}
									onChange={event =>
										setDraftName(event.target.value)
									}
								/>
							</div>
							<div className={styles.metadataField}>
								<label htmlFor="draft-usage">
									Intended use
								</label>
								<select
									id="draft-usage"
									value={usage}
									disabled={busy || saved}
									onChange={event => {
										const value = event.target.value
										if (
											value === 'collection' ||
											value === 'daily'
										)
											setUsage(value)
									}}
								>
									<option value="collection">Set/pack</option>
									<option value="daily">Daily</option>
								</select>
							</div>
							<button
								type="submit"
								disabled={busy || saved || loading}
							>
								Save draft
							</button>
						</form>
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
