import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faPenToSquare,
	faTrashCan,
	faRotate,
	faPlusLarge,
	faPalette,
	faXmark,
	faSquareArrowLeft,
} from '@fortawesome/pro-solid-svg-icons'
import type { Database } from '../../types/database'
import {
	renderAuthoredHexPuzzle,
	type AuthoredHexPuzzle,
	type AuthoringPalette,
} from '../../puzzles/hexAuthoring'
import {
	deletePuzzleDraft,
	editPuzzleDraft,
	loadPuzzleDrafts,
	bulkPuzzleDrafts,
	replacePuzzleDraft,
	type LibraryDraft,
} from '../../services/puzzleLibrary'
import {
	generateDraftPreview,
	puzzleDraftArgs,
	type PuzzleUsage,
} from '../../services/puzzleDrafts'
import { HEX_PUZZLE_RECIPES } from '../../puzzles/hexPuzzle'
import HexPuzzleBoard from '../puzzle/HexPuzzleBoard'
import PuzzleMode from '../puzzle/PuzzleMode'
import paletteStyles from '../controls/color-schemes/SchemePicker.module.css'
import styles from './AdminPortal.module.css'
import Checkbox from '../shared/Checkbox'
import AdminIconButton from './AdminIconButton'
import PuzzleDraftForm from './PuzzleDraftForm'
import useUnsavedDraft, { confirmDiscardDraft } from './useUnsavedDraft'

function message(cause: unknown) {
	return cause instanceof Error
		? cause.message
		: 'Unable to manage puzzle drafts.'
}

function DraftEditor({
	client,
	draft,
	palettes,
	onChanged,
	onBack,
	onDirtyChange,
	onRefreshPalettes,
	palettesLoading,
}: {
	readonly client: SupabaseClient<Database>
	readonly draft: LibraryDraft
	readonly palettes: readonly AuthoringPalette[]
	readonly onChanged: (status: string, updated: LibraryDraft | null) => void
	readonly onBack: () => void
	readonly onDirtyChange?: (dirty: boolean) => void
	readonly onRefreshPalettes?: () => void
	readonly palettesLoading?: boolean
}) {
	const [name, setName] = useState(draft.row.name)
	const [paletteId, setPaletteId] = useState(draft.row.palette_id)
	const [usage, setUsage] = useState<PuzzleUsage>(
		draft.row.usage === 'daily' ? 'daily' : 'collection',
	)
	const [busy, setBusy] = useState(false)
	const working = useRef(false)
	const [error, setError] = useState('')
	const [confirmDelete, setConfirmDelete] = useState(false)
	const [recipeId, setRecipeId] = useState<string>(draft.puzzle.recipe.id)
	const [replacement, setReplacement] = useState<AuthoredHexPuzzle | null>(
		null,
	)
	const [previewRun, setPreviewRun] = useState(0)
	const previewedSeeds = useRef(
		new Map([
			[`hexagon:${draft.puzzle.recipe.id}`, new Set([draft.puzzle.seed])],
		]),
	)
	const puzzle = replacement ?? draft.puzzle
	const palette = palettes.find(value => value.id === paletteId)
	const dirty =
		name !== draft.row.name ||
		paletteId !== draft.row.palette_id ||
		usage !== draft.row.usage ||
		replacement !== null
	useUnsavedDraft(dirty || busy, onDirtyChange)

	async function generate() {
		if (working.current) return
		setError('')
		working.current = true
		setBusy(true)
		try {
			if (draft.assigned)
				throw new Error(
					'Unassign the puzzle before replacing its design.',
				)
			const recipe = HEX_PUZZLE_RECIPES.find(
				value => value.id === recipeId,
			)
			if (!recipe || !palette)
				throw new Error(
					'Choose a recipe and palette before generating.',
				)
			const next = await generateDraftPreview(
				client,
				recipe,
				paletteId,
				previewedSeeds.current,
			)
			setReplacement(next)
			setPreviewRun(value => value + 1)
		} catch (cause) {
			setError(message(cause))
		} finally {
			working.current = false
			setBusy(false)
		}
	}

	async function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		if (working.current) return
		setError('')
		if (!name.trim()) {
			setError('Enter a name for the puzzle draft.')
			return
		}
		working.current = true
		setBusy(true)
		try {
			const updatedPuzzle = { ...puzzle, paletteId }
			if (replacement) {
				await replacePuzzleDraft(
					client,
					draft.row.id,
					name,
					usage,
					updatedPuzzle,
				)
			} else {
				await editPuzzleDraft(
					client,
					draft.row.id,
					name,
					paletteId,
					usage,
				)
			}
			const args = puzzleDraftArgs(
				draft.row.id,
				name,
				usage,
				updatedPuzzle,
			)
			setName(name.trim())
			onChanged('Draft changes saved.', {
				...draft,
				row: {
					...draft.row,
					name: name.trim(),
					palette_id: paletteId,
					usage,
					board_size: args.p_board_size,
					rotation_allowed: args.p_rotation_allowed,
					difficulty: args.p_difficulty,
					definition: args.p_definition,
				},
				puzzle: updatedPuzzle,
			})
		} catch (cause) {
			setError(message(cause))
		} finally {
			working.current = false
			setBusy(false)
		}
	}

	async function remove() {
		if (working.current) return
		working.current = true
		setBusy(true)
		setError('')
		try {
			await deletePuzzleDraft(client, draft.row.id)
			onChanged(`Deleted "${draft.row.name}".`, null)
		} catch (cause) {
			setError(message(cause))
		} finally {
			working.current = false
			setBusy(false)
		}
	}

	return (
		<article aria-label={`Edit ${draft.row.name}`}>
			<button
				type="button"
				className={styles.backLink}
				disabled={busy}
				onClick={() => {
					if (!dirty || confirmDiscardDraft()) onBack()
				}}
			>
				<FontAwesomeIcon icon={faSquareArrowLeft} aria-hidden="true" />{' '}
				Back to library
			</button>
			<h2>Editing: {draft.row.name}</h2>
			<p>
				{puzzle.recipe.label} ·{' '}
				{draft.assigned ? 'Assigned' : 'Unassigned'}
			</p>
			{error && <p role="alert">{error}</p>}
			<PuzzleDraftForm
				mode="edit"
				palettes={palettes}
				paletteId={paletteId}
				onPaletteChange={setPaletteId}
				onRefreshPalettes={onRefreshPalettes}
				palettesLoading={palettesLoading}
				busy={busy}
				generation={
					draft.assigned
						? undefined
						: {
								recipeId,
								onRecipeChange: setRecipeId,
								onGenerate: () => {
									void generate()
								},
							}
				}
				metadata={{
					name,
					usage,
					onNameChange: setName,
					onUsageChange: setUsage,
					assigned: draft.assigned,
					recipeLabel: draft.puzzle.recipe.label,
					submitDisabled: !palette || palettesLoading,
				}}
				onSubmit={save}
			/>
			{!draft.assigned && (
				<p>
					Randomize previews a replacement. Save Changes replaces the
					saved design; leaving without saving keeps the original.
				</p>
			)}
			{draft.assigned && (
				<p>Unassign this puzzle before replacing its design.</p>
			)}
			{palette ? (
				<div className={styles.playtest}>
					{puzzle.recipe.rotation && (
						<p className={styles.rotationHelp}>
							Tap tray pieces to rotate; drag to place. Double-tap
							board pieces to return. Keyboard: Enter/Space
							rotates, activate a tile to place, Delete/Backspace
							returns.
						</p>
					)}
					<PuzzleMode
						key={previewRun}
						previewPuzzle={renderAuthoredHexPuzzle(
							{ ...puzzle, paletteId },
							palette,
						)}
					/>
				</div>
			) : (
				<p role="alert">
					This draft's palette is unavailable. Choose another palette
					or refresh palettes.
				</p>
			)}
			{confirmDelete ? (
				<div role="group" aria-label="Confirm draft deletion">
					<p>
						Delete "{draft.row.name}" permanently? Its saved design
						and private solution will be removed.
					</p>
					<button
						type="button"
						disabled={busy}
						onClick={() => {
							void remove()
						}}
					>
						Confirm delete
					</button>
					<button
						type="button"
						disabled={busy}
						onClick={() => setConfirmDelete(false)}
					>
						Keep draft
					</button>
				</div>
			) : (
				<button
					type="button"
					disabled={busy || draft.assigned}
					onClick={() => setConfirmDelete(true)}
				>
					Delete draft
				</button>
			)}
		</article>
	)
}

export default function PuzzleDraftLibrary({
	client,
	palettes,
	revision,
	onNew,
	onDirtyChange,
	onRefreshPalettes,
	palettesLoading,
}: {
	readonly client: SupabaseClient<Database>
	readonly palettes: readonly AuthoringPalette[]
	readonly revision: number
	readonly onNew?: () => void
	readonly onDirtyChange?: (dirty: boolean) => void
	readonly onRefreshPalettes?: () => void
	readonly palettesLoading?: boolean
}) {
	const [drafts, setDrafts] = useState<readonly LibraryDraft[]>([])
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [loadFailed, setLoadFailed] = useState(false)
	const [error, setError] = useState('')
	const [reload, setReload] = useState(0)
	const [filter, setFilter] = useState('all')
	const [status, setStatus] = useState('')
	const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set())
	const [action, setAction] = useState<{
		kind: 'delete' | 'palette'
		ids: readonly string[]
	} | null>(null)
	const [bulkPaletteId, setBulkPaletteId] = useState('')
	const [bulkBusy, setBulkBusy] = useState(false)
	const bulkWorking = useRef(false)
	const actionPanel = useRef<HTMLDivElement>(null)
	useUnsavedDraft(bulkBusy, onDirtyChange)
	useEffect(() => {
		if (action) actionPanel.current?.focus()
	}, [action])
	useEffect(() => {
		let active = true
		async function load() {
			setLoading(true)
			setLoadFailed(false)
			setError('')
			try {
				const next = await loadPuzzleDrafts(client)
				if (active) {
					setDrafts(next)
					setCheckedIds(
						previous =>
							new Set(
								[...previous].filter(id =>
									next.some(draft => draft.row.id === id),
								),
							),
					)
					setAction(null)
					setSelectedId(previous =>
						next.some(draft => draft.row.id === previous)
							? previous
							: null,
					)
				}
			} catch (cause) {
				if (active) {
					setError(message(cause))
					setLoadFailed(true)
				}
			} finally {
				if (active) setLoading(false)
			}
		}
		void load()
		return () => {
			active = false
		}
	}, [client, revision, reload])
	const selected = drafts.find(value => value.row.id === selectedId)
	const visible = drafts.filter(
		value => filter === 'all' || value.row.usage === filter,
	)
	const checked = visible.filter(draft => checkedIds.has(draft.row.id))
	const allChecked = visible.length > 0 && checked.length === visible.length
	const hasAssigned = checked.some(draft => draft.assigned)
	function startAction(kind: 'delete' | 'palette', ids: readonly string[]) {
		setError('')
		setStatus('')
		setBulkPaletteId('')
		setAction({ kind, ids })
	}
	async function applyAction() {
		if (!action || bulkWorking.current) return
		if (
			action.kind === 'palette' &&
			!palettes.some(palette => palette.id === bulkPaletteId)
		) {
			setError('Choose a palette before applying changes.')
			return
		}
		bulkWorking.current = true
		setBulkBusy(true)
		setError('')
		try {
			await bulkPuzzleDrafts(
				client,
				action.ids,
				action.kind === 'delete'
					? { kind: 'delete' }
					: { kind: 'palette', paletteId: bulkPaletteId },
			)
			setStatus(
				action.kind === 'delete'
					? `Deleted ${action.ids.length} draft${action.ids.length === 1 ? '' : 's'}.`
					: `Updated the palette for ${action.ids.length} draft${action.ids.length === 1 ? '' : 's'}.`,
			)
			setCheckedIds(new Set())
			setAction(null)
			setReload(value => value + 1)
		} catch (cause) {
			setError(message(cause))
		} finally {
			bulkWorking.current = false
			setBulkBusy(false)
		}
	}
	if (selected) {
		return (
			<>
				{status && <p role="status">{status}</p>}
				<DraftEditor
					key={selected.row.id}
					client={client}
					draft={selected}
					palettes={palettes}
					onBack={() => {
						setSelectedId(null)
						setReload(value => value + 1)
						setStatus('')
					}}
					onDirtyChange={onDirtyChange}
					onRefreshPalettes={onRefreshPalettes}
					palettesLoading={palettesLoading}
					onChanged={(status, updated) => {
						setStatus(status)
						setDrafts(previous =>
							updated
								? previous.map(value =>
										value.row.id === updated.row.id
											? updated
											: value,
									)
								: previous.filter(
										value =>
											value.row.id !== selected.row.id,
									),
						)
						setSelectedId(null)
						setReload(value => value + 1)
					}}
				/>
			</>
		)
	}
	return (
		<section aria-labelledby="draft-library-title">
			<div className={styles.galleryHeading}>
				<h2 id="draft-library-title">Puzzle drafts</h2>
				<div className={styles.galleryControls}>
					{onNew && (
						<AdminIconButton
							icon={faPlusLarge}
							label="New puzzle"
							disabled={bulkBusy}
							onClick={onNew}
						/>
					)}
					<AdminIconButton
						icon={faRotate}
						label="Refresh drafts"
						disabled={loading || bulkBusy}
						onClick={() => {
							setCheckedIds(new Set())
							setAction(null)
							setReload(value => value + 1)
						}}
					/>
					<select
						id="draft-filter"
						aria-label="Show drafts"
						value={filter}
						disabled={bulkBusy}
						onChange={event => {
							setFilter(event.target.value)
							setSelectedId(null)
							setCheckedIds(new Set())
							setAction(null)
						}}
					>
						<option value="all">All uses</option>
						<option value="collection">Set/pack</option>
						<option value="daily">Daily</option>
					</select>
				</div>
			</div>
			{error && <p role="alert">{error}</p>}
			{status && <p role="status">{status}</p>}
			{loading ? (
				<p role="status">Loading puzzle drafts...</p>
			) : loadFailed ? null : (
				<>
					<div className={styles.selectionRow}>
						{visible.length > 0 && (
							<Checkbox
								plain
								label="Select all shown"
								checked={allChecked}
								indeterminate={
									checked.length > 0 && !allChecked
								}
								disabled={bulkBusy}
								onChange={value => {
									setCheckedIds(
										new Set(
											value
												? visible.map(
														draft => draft.row.id,
													)
												: [],
										),
									)
									setAction(null)
								}}
							/>
						)}
						{checked.length > 0 && (
							<div
								className={styles.bulkToolbar}
								role="group"
								aria-label="Bulk draft actions"
							>
								<span className={styles.selectionCount}>
									({checked.length} drafts selected)
								</span>
								<AdminIconButton
									icon={faPalette}
									label="Change palette"
									disabled={bulkBusy}
									onClick={() =>
										startAction(
											'palette',
											checked.map(draft => draft.row.id),
										)
									}
								/>
								<AdminIconButton
									icon={faTrashCan}
									label="Delete selected"
									className={styles.deleteAction}
									disabled={bulkBusy || hasAssigned}
									onClick={() =>
										startAction(
											'delete',
											checked.map(draft => draft.row.id),
										)
									}
								/>
								<AdminIconButton
									icon={faXmark}
									label="Clear selection"
									disabled={bulkBusy}
									onClick={() => {
										setCheckedIds(new Set())
										setAction(null)
									}}
								/>
							</div>
						)}
					</div>
					{hasAssigned && (
						<p className={styles.rotationHelp}>
							Unassign selected drafts before deleting them.
						</p>
					)}
					{action && (
						<div
							role="group"
							ref={actionPanel}
							tabIndex={-1}
							aria-label={
								action.kind === 'delete'
									? 'Confirm gallery deletion'
									: 'Change selected palettes'
							}
							className={styles.bulkPanel}
						>
							<p>
								{action.kind === 'delete'
									? `Permanently delete ${action.ids.length} draft${action.ids.length === 1 ? '' : 's'}?`
									: `Change palette for ${action.ids.length} draft${action.ids.length === 1 ? '' : 's'}?`}
							</p>
							<ul>
								{drafts
									.filter(draft =>
										action.ids.includes(draft.row.id),
									)
									.map(draft => (
										<li key={draft.row.id}>
											{draft.row.name}
										</li>
									))}
							</ul>
							{action.kind === 'palette' && (
								<fieldset
									className={styles.palettePicker}
									disabled={bulkBusy}
								>
									<legend>Bulk palette</legend>
									<ul className={paletteStyles.list}>
										{palettes.map(palette => (
											<li key={palette.id}>
												<button
													type="button"
													className={
														styles.paletteOption
													}
													aria-pressed={
														bulkPaletteId ===
														palette.id
													}
													aria-label={`Apply ${palette.name} to selected drafts`}
													onClick={() =>
														setBulkPaletteId(
															palette.id,
														)
													}
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
							<button
								type="button"
								disabled={
									bulkBusy ||
									(action.kind === 'palette' &&
										!bulkPaletteId)
								}
								onClick={() => {
									void applyAction()
								}}
							>
								{action.kind === 'delete'
									? 'Confirm delete'
									: 'Apply palette'}
							</button>
							<button
								type="button"
								disabled={bulkBusy}
								onClick={() => setAction(null)}
							>
								Cancel
							</button>
						</div>
					)}
					{!visible.length && <p>No drafts match this view.</p>}
					<ul className={styles.draftList}>
						{visible.map(draft => {
							const palette = palettes.find(
								value => value.id === draft.puzzle.paletteId,
							)
							const preview = palette
								? renderAuthoredHexPuzzle(draft.puzzle, palette)
								: null
							return (
								<li
									key={draft.row.id}
									className={styles.draftCard}
									aria-label={`Draft ${draft.row.name}`}
									data-selected={checkedIds.has(draft.row.id)}
								>
									<div className={styles.cardActions}>
										<Checkbox
											plain
											hideLabel
											label={`Select draft ${draft.row.name}`}
											className={styles.cardCheckbox}
											checked={checkedIds.has(
												draft.row.id,
											)}
											disabled={bulkBusy}
											onChange={value => {
												setCheckedIds(previous => {
													const next = new Set(
														previous,
													)
													if (value)
														next.add(draft.row.id)
													else
														next.delete(
															draft.row.id,
														)
													return next
												})
												setAction(null)
											}}
										/>
										<button
											type="button"
											className={`${styles.cardAction} ${styles.editAction}`}
											disabled={bulkBusy}
											aria-label={`Edit draft ${draft.row.name}`}
											title={`Edit ${draft.row.name}`}
											onClick={() => {
												setStatus('')
												setAction(null)
												setSelectedId(draft.row.id)
											}}
										>
											<FontAwesomeIcon
												icon={faPenToSquare}
												aria-hidden="true"
											/>
										</button>
										<button
											type="button"
											className={`${styles.cardAction} ${styles.deleteAction}`}
											disabled={
												bulkBusy || draft.assigned
											}
											aria-label={`Delete draft ${draft.row.name}`}
											title={
												draft.assigned
													? 'Unassign this draft before deleting.'
													: `Delete ${draft.row.name}`
											}
											onClick={() =>
												startAction('delete', [
													draft.row.id,
												])
											}
										>
											<FontAwesomeIcon
												icon={faTrashCan}
												aria-hidden="true"
											/>
										</button>
									</div>
									{preview ? (
										<span
											aria-hidden="true"
											className={styles.thumbnail}
										>
											<HexPuzzleBoard
												target
												radius={preview.radius}
												colors={preview.target}
											/>
										</span>
									) : (
										<span>Palette unavailable</span>
									)}
									<strong>{draft.row.name}</strong>
									<span className={styles.difficulty}>
										{draft.puzzle.recipe.label}
									</span>
									<span className={styles.assignment}>
										{draft.row.usage === 'daily'
											? 'Daily'
											: 'Set/pack'}{' '}
										·{' '}
										{draft.assigned
											? 'Assigned'
											: 'Unassigned'}
									</span>
								</li>
							)
						})}
					</ul>
				</>
			)}
		</section>
	)
}
