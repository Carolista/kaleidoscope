import { useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
	faPenToSquare,
	faTrashCan,
	faRotate,
	faPlusLarge,
	faPalette,
	faLayerGroup,
} from '@fortawesome/pro-solid-svg-icons'
import type { Database } from '@/lib/supabase'
import {
	PUZZLE_SHAPE_LABELS,
	renderAuthoredPuzzle,
	type AuthoringPalette,
} from '@/domain/puzzles'
import {
	bulkPuzzleDrafts,
	type LibraryDraft,
	manageDraftSet,
	type DraftSet,
} from '@/features/admin/services'
import { PuzzleBoard } from '@/ui/puzzle'
import PaletteFieldset from './PaletteFieldset'
import styles from './PuzzleDraftLibrary.module.css'
import {
	AdminIconButton,
	AdminFeedback,
	AdminGallery,
	AdminItemCard,
	AdminSectionHeading,
	AdminSelectionBar,
	useCheckedIds,
	errorMessage,
} from '@/features/admin/common'
import {
	Button,
	ConfirmDialog,
	Loading,
	PaletteChoices,
	Select,
} from '@/ui/components'
import { useCatalog, useCatalogInvalidation } from '@/features/admin/catalog'
import PuzzleDraftEditor from './PuzzleDraftEditor'
import { useUnsavedDraft } from '@/ui/navigation'
import { useModalState } from '@/ui/hooks'
import { compareSetOrder } from '@/features/admin/sets'

function setOrderKey(draft: LibraryDraft) {
	return {
		setName: draft.collectionName,
		position: draft.collectionPosition,
		name: draft.row.name,
	}
}

// Only unassigned drafts may be deleted, singly or in bulk.
function deletable(draft: LibraryDraft) {
	return !draft.assigned && !draft.row.published_at && !draft.row.release_at
}

const fallbackError = 'Unable to manage puzzle drafts.'

export default function PuzzleDraftLibrary({
	client,
	palettes,
	onNew,
	catalogStatus,
	onRefreshPalettes,
	palettesLoading,
	palettesRefreshing,
	palettesError,
}: {
	readonly client: SupabaseClient<Database>
	readonly palettes: readonly AuthoringPalette[]
	readonly onNew?: () => void
	readonly catalogStatus?: 'drafts' | 'assigned'
	readonly onRefreshPalettes?: () => void
	readonly palettesLoading?: boolean
	readonly palettesRefreshing?: boolean
	readonly palettesError?: boolean
}) {
	const draftCatalog = useCatalog('puzzleDrafts', client)
	const invalidate = useCatalogInvalidation()
	const drafts: readonly LibraryDraft[] = draftCatalog.data ?? []
	const loading = draftCatalog.loading
	const loadFailed = !!draftCatalog.error && !loading
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [error, setError] = useState('')
	const [filter, setFilter] = useState('all')
	const [status, setStatus] = useState('')
	const [setChoice, setSetChoice] = useState('all')
	const [action, setAction, actionModal] = useModalState<{
		kind: 'delete' | 'palette' | 'set'
		ids: readonly string[]
	}>()
	const [bulkPaletteId, setBulkPaletteId] = useState('')
	const [bulkSetId, setBulkSetId] = useState('')
	const [bulkBusy, setBulkBusy] = useState(false)
	const [actionError, setActionError] = useState('')
	const bulkWorking = useRef(false)
	useUnsavedDraft({ dirty: false, pending: bulkBusy })
	const setCatalog = useCatalog('puzzleSets', client, action?.kind === 'set')
	const draftSets: readonly DraftSet[] = setCatalog.data ?? []
	const setsLoading = setCatalog.loading
	const setsError =
		action?.kind === 'set' && setCatalog.error
			? errorMessage(setCatalog.error, fallbackError)
			: ''
	const selected = drafts.find(value => value.row.id === selectedId)
	const inStatus = drafts.filter(
		value =>
			!catalogStatus ||
			(!value.row.published_at &&
				!value.row.release_at &&
				value.assigned === (catalogStatus === 'assigned')),
	)
	// Unassigned drafts never belong to a set, so only offer the set filter elsewhere.
	const showSetFilter = catalogStatus !== 'drafts'
	const setOptions = [
		...new Map(
			inStatus.flatMap(value =>
				value.collectionId
					? [[value.collectionId, value.collectionName ?? '']]
					: [],
			),
		),
	].sort((a, b) => a[1].localeCompare(b[1]))
	const shownSet =
		setChoice === 'all' ||
		setChoice === 'none' ||
		setOptions.some(([id]) => id === setChoice)
			? setChoice
			: 'all'
	const filtered = inStatus.filter(
		value =>
			(filter === 'all' || value.row.usage === filter) &&
			(shownSet === 'all' ||
				(shownSet === 'none'
					? !value.collectionId
					: value.collectionId === shownSet)),
	)
	const visible =
		catalogStatus === 'assigned'
			? [...filtered].sort((a, b) =>
					compareSetOrder(setOrderKey(a), setOrderKey(b)),
				)
			: filtered
	const selection = useCheckedIds(visible.map(draft => draft.row.id))
	const checked = visible.filter(draft => selection.checked.has(draft.row.id))
	// Each set uses one shape, so a batch must share the shape of its set.
	const canAssign =
		checked.every(
			draft => !draft.assigned && draft.row.usage === 'collection',
		) && new Set(checked.map(draft => draft.puzzle.shape)).size <= 1
	const assignShape =
		action?.kind === 'set'
			? drafts.find(draft => action.ids.includes(draft.row.id))?.puzzle
					.shape
			: undefined
	const assignableSets = draftSets.filter(
		set => set.row.shape_id === assignShape,
	)
	const canDelete = checked.every(deletable)
	function startAction(
		kind: 'delete' | 'palette' | 'set',
		ids: readonly string[],
	) {
		setError('')
		setActionError('')
		setStatus('')
		setBulkPaletteId('')
		setBulkSetId('')
		setAction({ kind, ids })
	}
	async function applyAction() {
		if (!action || bulkWorking.current) return
		if (
			action.kind === 'palette' &&
			(palettesLoading ||
				palettesError ||
				!palettes.some(palette => palette.id === bulkPaletteId))
		) {
			setActionError('Choose a palette before applying changes.')
			return
		}
		if (
			action.kind === 'set' &&
			!assignableSets.some(set => set.row.id === bulkSetId)
		) {
			setActionError('Choose a draft set before assigning puzzles.')
			return
		}
		bulkWorking.current = true
		setBulkBusy(true)
		setActionError('')
		try {
			if (action.kind === 'set') {
				await manageDraftSet(client, bulkSetId, {
					kind: 'append',
					puzzleIds: action.ids,
				})
			} else
				await bulkPuzzleDrafts(
					client,
					action.ids,
					action.kind === 'delete'
						? { kind: 'delete' }
						: { kind: 'palette', paletteId: bulkPaletteId },
				)
			setAction(null, () => {
				setStatus(
					action.kind === 'set'
						? `Assigned ${action.ids.length} draft${action.ids.length === 1 ? '' : 's'} to set.`
						: action.kind === 'delete'
							? `Deleted ${action.ids.length} draft${action.ids.length === 1 ? '' : 's'}.`
							: `Updated the palette for ${action.ids.length} draft${action.ids.length === 1 ? '' : 's'}.`,
				)
				selection.clear()
				invalidate('puzzleDrafts', 'puzzleSets')
			})
		} catch (cause) {
			setActionError(errorMessage(cause, fallbackError))
		} finally {
			bulkWorking.current = false
			setBulkBusy(false)
		}
	}
	if (selected) {
		return (
			<>
				<AdminFeedback status={status} />
				<PuzzleDraftEditor
					key={selected.row.id}
					client={client}
					draft={selected}
					palettes={palettes}
					onRefreshPalettes={onRefreshPalettes}
					palettesLoading={palettesLoading}
					palettesRefreshing={palettesRefreshing}
					palettesError={palettesError}
					onChanged={(status, updated) => {
						setStatus(status)
						draftCatalog.update(previous =>
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
						// Names, palettes, and designs also appear in set previews.
						invalidate('puzzleDrafts', 'puzzleSets')
					}}
				/>
			</>
		)
	}
	return (
		<section aria-labelledby="draft-library-title">
			<AdminSectionHeading
				id="draft-library-title"
				title={
					catalogStatus === 'assigned'
						? 'Assigned puzzles'
						: 'Puzzle drafts'
				}
			>
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
						selection.clear()
						setAction(null)
						setError('')
						void draftCatalog.refresh().catch(() => {})
					}}
				/>
				<Select
					id="draft-filter"
					aria-label="Show drafts"
					value={filter}
					disabled={bulkBusy}
					onChange={event => {
						setFilter(event.target.value)
						setSelectedId(null)
						selection.clear()
						setAction(null)
					}}
				>
					<option value="all">All uses</option>
					<option value="collection">Set/pack</option>
					<option value="daily">Daily</option>
				</Select>
				{showSetFilter && (
					<Select
						id="draft-set-filter"
						aria-label="Show set"
						value={shownSet}
						disabled={bulkBusy}
						onChange={event => {
							setSetChoice(event.target.value)
							selection.clear()
							setAction(null)
						}}
					>
						<option value="all">All sets</option>
						<option value="none">No set</option>
						{setOptions.map(([id, name]) => (
							<option key={id} value={id}>
								{name}
							</option>
						))}
					</Select>
				)}
			</AdminSectionHeading>
			<AdminFeedback
				error={
					error ||
					(draftCatalog.error
						? errorMessage(draftCatalog.error, fallbackError)
						: '')
				}
				status={status}
			/>
			{palettesLoading && (
				<Loading
					label={
						palettesRefreshing
							? 'Refreshing palettes…'
							: 'Loading Supabase palettes...'
					}
				/>
			)}
			{loading ? (
				<Loading
					label={
						draftCatalog.refreshing
							? 'Refreshing puzzle drafts…'
							: 'Loading puzzle drafts...'
					}
				/>
			) : loadFailed ? null : (
				<>
					<AdminSelectionBar
						label="Bulk draft actions"
						shown={visible.length}
						checked={checked.length}
						disabled={bulkBusy}
						onSelectAll={value => {
							selection.setAll(value)
							setAction(null)
						}}
						onClear={() => {
							selection.clear()
							setAction(null)
						}}
					>
						<AdminIconButton
							icon={faLayerGroup}
							label="Assign to set"
							title={
								canAssign
									? undefined
									: 'Only unassigned Set/pack drafts of one shape can be assigned to a set.'
							}
							disabled={bulkBusy || !canAssign}
							onClick={() => startAction('set', selection.ids)}
						/>
						<AdminIconButton
							icon={faPalette}
							label="Change palette"
							disabled={bulkBusy}
							onClick={() =>
								startAction('palette', selection.ids)
							}
						/>
						{canDelete && (
							<AdminIconButton
								icon={faTrashCan}
								label="Delete selected"
								tone="delete"
								disabled={bulkBusy}
								onClick={() =>
									startAction('delete', selection.ids)
								}
							/>
						)}
					</AdminSelectionBar>
					{action && (
						<ConfirmDialog
							{...actionModal}
							title={
								action.kind === 'set'
									? 'Assign selected puzzles to set'
									: action.kind === 'delete'
										? 'Confirm gallery deletion'
										: 'Change selected palettes'
							}
							closeLabel="Close puzzle action"
							destructive={action.kind === 'delete'}
							confirmLabel={
								action.kind === 'set'
									? 'Assign puzzles'
									: action.kind === 'delete'
										? 'Confirm delete'
										: 'Apply palette'
							}
							pending={
								bulkBusy
									? action.kind === 'delete'
										? 'Deleting puzzle drafts…'
										: action.kind === 'set'
											? 'Assigning puzzles to set…'
											: 'Updating puzzle palettes…'
									: null
							}
							error={actionError || setsError}
							confirmDisabled={
								(action.kind === 'palette' &&
									(!bulkPaletteId ||
										palettesLoading ||
										palettesError)) ||
								(action.kind === 'set' &&
									(setsLoading || !bulkSetId))
							}
							onConfirm={() => {
								void applyAction()
							}}
							onCancel={() => setAction(null)}
						>
							<p>
								{action.kind === 'set'
									? `Assign ${action.ids.length} drafts to a set?`
									: action.kind === 'delete'
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
							{action.kind === 'set' &&
								(setsLoading ? (
									<Loading label="Loading draft sets..." />
								) : (
									<>
										<label htmlFor="bulk-set">
											Draft set
										</label>
										<Select
											id="bulk-set"
											value={bulkSetId}
											disabled={bulkBusy}
											onChange={event =>
												setBulkSetId(event.target.value)
											}
										>
											<option value="">
												Choose a set
											</option>
											{assignableSets.map(set => (
												<option
													key={set.row.id}
													value={set.row.id}
												>
													{set.row.name} (
													{set.row.kind},{' '}
													{set.members.length}{' '}
													puzzles)
												</option>
											))}
										</Select>
										{!assignableSets.length &&
											!actionError &&
											!setsError &&
											assignShape && (
												<p>
													Create a{' '}
													{PUZZLE_SHAPE_LABELS[
														assignShape
													].toLowerCase()}{' '}
													draft set using Manage sets,
													then select puzzles to
													assign.
												</p>
											)}
									</>
								))}
							{action.kind === 'palette' && (
								<PaletteFieldset
									disabled={
										bulkBusy ||
										palettesLoading ||
										palettesError
									}
								>
									<legend>Bulk palette</legend>
									<PaletteChoices
										palettes={palettes}
										selectedId={bulkPaletteId}
										onSelect={setBulkPaletteId}
										showNames
										disabled={
											bulkBusy ||
											palettesLoading ||
											!!palettesError
										}
										label={palette =>
											`Apply ${palette.name} to selected drafts`
										}
									/>
								</PaletteFieldset>
							)}
							{action.kind === 'set' && setsError && (
								<Button
									disabled={setsLoading || bulkBusy}
									onClick={() => {
										setActionError('')
										setBulkSetId('')
										void setCatalog
											.refresh()
											.catch(() => {})
									}}
								>
									Retry loading sets
								</Button>
							)}
						</ConfirmDialog>
					)}
					{!visible.length && <p>No drafts match this view.</p>}
					<AdminGallery layout="puzzles">
						{visible.map(draft => {
							const palette = palettes.find(
								value => value.id === draft.puzzle.paletteId,
							)
							const preview = palette
								? renderAuthoredPuzzle(draft.puzzle, palette)
								: null
							return (
								<AdminItemCard
									key={draft.row.id}
									label={`Draft ${draft.row.name}`}
									selectLabel={`Select draft ${draft.row.name}`}
									selected={selection.checked.has(
										draft.row.id,
									)}
									selectDisabled={bulkBusy}
									onSelect={value => {
										selection.toggle(draft.row.id, value)
										setAction(null)
									}}
									preview={
										preview ? (
											<span
												aria-hidden="true"
												className={styles.thumbnail}
											>
												<PuzzleBoard
													target
													shape={preview.shape}
													gridSize={preview.gridSize}
													colors={preview.target}
												/>
											</span>
										) : (
											<span>Palette unavailable</span>
										)
									}
									actions={
										<>
											<AdminIconButton
												icon={faPenToSquare}
												tone="edit"
												disabled={bulkBusy}
												label={`Edit draft ${draft.row.name}`}
												title={`Edit ${draft.row.name}`}
												onClick={() => {
													setStatus('')
													setAction(null)
													setSelectedId(draft.row.id)
												}}
											/>
											{deletable(draft) && (
												<AdminIconButton
													icon={faTrashCan}
													tone="delete"
													disabled={bulkBusy}
													label={`Delete draft ${draft.row.name}`}
													title={`Delete ${draft.row.name}`}
													onClick={() =>
														startAction('delete', [
															draft.row.id,
														])
													}
												/>
											)}
										</>
									}
								>
									<strong>{draft.row.name}</strong>
									<span>
										{
											PUZZLE_SHAPE_LABELS[
												draft.puzzle.shape
											]
										}{' '}
										· {draft.puzzle.recipe.label}
									</span>
									<span>
										{draft.row.usage === 'daily'
											? 'Daily'
											: draft.collectionKind === 'core'
												? 'Core'
												: draft.collectionKind ===
													  'reward'
													? 'Reward'
													: draft.collectionKind ===
														  'paid'
														? 'Pack'
														: 'Set/pack'}{' '}
										·{' '}
										{draft.collectionName ??
											(draft.assigned
												? 'Assigned'
												: 'Unassigned')}
									</span>
								</AdminItemCard>
							)
						})}
					</AdminGallery>
				</>
			)}
		</section>
	)
}
