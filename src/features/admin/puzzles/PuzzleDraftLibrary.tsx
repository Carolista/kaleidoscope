import { useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
	faEye,
	faPenToSquare,
	faTrashCan,
	faRotate,
	faPlusLarge,
	faPalette,
	faLayerGroup,
	faLinkSlash,
} from '@fortawesome/pro-solid-svg-icons'
import type { Database } from '@/lib/supabase'
import {
	PUZZLE_SHAPE_IDS,
	PUZZLE_SHAPE_LABELS,
	renderAuthoredPuzzle,
	type AuthoringPalette,
} from '@/domain/puzzles'
import {
	bulkPuzzleDrafts,
	groupAcceptsPuzzle,
	managePuzzleGroup,
	PUZZLE_GROUP_PURPOSES,
	puzzleGroupPurposeLabels,
	releaseStateOf,
	type LibraryDraft,
	type PuzzleGroup,
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
import { ReleaseStateIcon, releaseStateLabel } from '@/features/admin/release'
import PuzzleDraftEditor from './PuzzleDraftEditor'
import PublishedPuzzleView from './PublishedPuzzleView'
import { useUnsavedDraft } from '@/ui/navigation'
import { useModalState } from '@/ui/hooks'
import { compareGroupOrder } from '@/features/admin/groups'

function groupOrderKey(draft: LibraryDraft) {
	return {
		groupName: draft.groupName,
		position: draft.groupPosition,
		name: draft.row.name,
	}
}

export type PuzzleStatus = 'drafts' | 'assigned' | 'scheduled' | 'published'
export type PuzzleStatusFilter = 'all' | PuzzleStatus

const statusOrder: readonly PuzzleStatus[] = [
	'drafts',
	'assigned',
	'scheduled',
	'published',
]

function puzzleStatus(draft: LibraryDraft): PuzzleStatus {
	const state = releaseStateOf(draft.row)
	if (state === 'scheduled') return 'scheduled'
	if (state === 'live') return 'published'
	return draft.assigned ? 'assigned' : 'drafts'
}

// Only drafts take bulk actions; scheduled and live puzzles are managed through their group.
function isEditable(status: PuzzleStatus) {
	return status === 'drafts' || status === 'assigned'
}

function releaseTime(draft: LibraryDraft) {
	return Date.parse(draft.row.release_at ?? '') || 0
}

// Only unassigned drafts may be deleted, singly or in bulk.
function deletable(draft: LibraryDraft) {
	return !draft.assigned && !draft.row.published_at && !draft.row.release_at
}

export interface LibraryView {
	readonly status: PuzzleStatusFilter
	readonly purpose: string
	readonly shape: string
	readonly track: string
	readonly group: string
}

const fallbackError = 'Unable to manage puzzle drafts.'

export default function PuzzleDraftLibrary({
	client,
	palettes,
	onNew,
	initialView,
	onRefreshPalettes,
	palettesLoading,
	palettesRefreshing,
	palettesError,
}: {
	readonly client: SupabaseClient<Database>
	readonly palettes: readonly AuthoringPalette[]
	readonly onNew?: (group?: PuzzleGroup, view?: LibraryView) => void
	// Restores the filters after returning from the creation form.
	readonly initialView?: LibraryView
	readonly onRefreshPalettes?: () => void
	readonly palettesLoading?: boolean
	readonly palettesRefreshing?: boolean
	readonly palettesError?: boolean
}) {
	const [statusFilter, setStatusFilter] = useState<PuzzleStatusFilter>(
		initialView?.status ?? 'all',
	)
	// Each source loads only when the chosen status can include its puzzles.
	const showDrafts =
		statusFilter !== 'scheduled' && statusFilter !== 'published'
	const showPrepared =
		statusFilter !== 'drafts' && statusFilter !== 'assigned'
	const draftCatalog = useCatalog('puzzleDrafts', client, showDrafts)
	const preparedCatalog = useCatalog('preparedPuzzles', client, showPrepared)
	const invalidate = useCatalogInvalidation()
	const puzzles: readonly LibraryDraft[] = [
		...(draftCatalog.data ?? []),
		...(preparedCatalog.data ?? []),
	]
	const loading = draftCatalog.loading || preparedCatalog.loading
	const refreshing = draftCatalog.refreshing || preparedCatalog.refreshing
	const catalogError =
		(showDrafts && draftCatalog.error) ||
		(showPrepared && preparedCatalog.error)
	const loadFailed = !!catalogError && !loading
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [error, setError] = useState('')
	const [purposeChoice, setPurposeFilter] = useState(
		initialView?.purpose ?? 'all',
	)
	const [shapeFilter, setShapeFilter] = useState(initialView?.shape ?? 'all')
	const [trackFilter, setTrackFilter] = useState(initialView?.track ?? 'all')
	const [status, setStatus] = useState('')
	const [groupChoice, setGroupChoice] = useState(initialView?.group ?? 'all')
	const [action, setAction, actionModal] = useModalState<{
		kind: 'delete' | 'palette' | 'group' | 'unassign'
		ids: readonly string[]
	}>()
	const [bulkPaletteId, setBulkPaletteId] = useState('')
	const [bulkGroupId, setBulkGroupId] = useState('')
	const [bulkBusy, setBulkBusy] = useState(false)
	const [actionError, setActionError] = useState('')
	const bulkWorking = useRef(false)
	useUnsavedDraft({ dirty: false, pending: bulkBusy })
	const selected = puzzles.find(value => value.row.id === selectedId)
	const inStatus = puzzles.filter(
		value => statusFilter === 'all' || puzzleStatus(value) === statusFilter,
	)
	// Unassigned drafts never belong to a group, so only offer those filters elsewhere.
	const showGroupFilters = statusFilter !== 'drafts'
	const purposeFilter = showGroupFilters ? purposeChoice : 'all'
	const inPurpose = inStatus.filter(
		value =>
			purposeFilter === 'all' || value.groupPurpose === purposeFilter,
	)
	const groupOptions = [
		...new Map(
			inPurpose.flatMap(value =>
				value.groupId ? [[value.groupId, value.groupName ?? '']] : [],
			),
		),
	].sort((a, b) => a[1].localeCompare(b[1]))
	const shownGroup =
		showGroupFilters &&
		(groupChoice === 'all' ||
			(groupChoice === 'none' && statusFilter !== 'assigned') ||
			groupOptions.some(([id]) => id === groupChoice))
			? groupChoice
			: 'all'
	const groupFilterActive = shownGroup !== 'all' && shownGroup !== 'none'
	const groupCatalog = useCatalog(
		'puzzleGroups',
		client,
		action?.kind === 'group' || groupFilterActive,
	)
	const groupsLoading = groupCatalog.loading
	const groupsError =
		action?.kind === 'group' && groupCatalog.error
			? errorMessage(groupCatalog.error, fallbackError)
			: ''
	// Released groups are locked, so only drafts can receive puzzles.
	const draftGroups: readonly PuzzleGroup[] = (
		groupCatalog.data ?? []
	).filter(group => !group.row.published_at && !group.row.release_at)
	// New puzzles join the filtered group when it is still an editable draft.
	const filteredGroup = groupFilterActive
		? draftGroups.find(
				group => group.row.id === shownGroup && !group.row.release_at,
			)
		: undefined
	const canCreate = showDrafts
	const filtered = inPurpose.filter(
		value =>
			(shapeFilter === 'all' || value.row.shape_id === shapeFilter) &&
			(trackFilter === 'all' ||
				value.row.rotation_allowed === (trackFilter === 'rotation')) &&
			(shownGroup === 'all' ||
				(shownGroup === 'none'
					? !value.groupId
					: value.groupId === shownGroup)),
	)
	// Unassigned, then assigned in group order, then scheduled and live by release time.
	const visible = [...filtered].sort((a, b) => {
		const state = puzzleStatus(a)
		return (
			statusOrder.indexOf(state) - statusOrder.indexOf(puzzleStatus(b)) ||
			(state === 'drafts'
				? 0
				: (state === 'assigned'
						? 0
						: releaseTime(a) - releaseTime(b)) ||
					compareGroupOrder(groupOrderKey(a), groupOrderKey(b)))
		)
	})
	const selectable = visible.filter(draft => isEditable(puzzleStatus(draft)))
	const selection = useCheckedIds(selectable.map(draft => draft.row.id))
	const checked = selectable.filter(draft =>
		selection.checked.has(draft.row.id),
	)
	// Groups accept only puzzles matching their shape and track, so the choices depend on the batch.
	const canAssign = checked.every(draft => !draft.assigned)
	const assigning =
		action?.kind === 'group'
			? puzzles.filter(draft => action.ids.includes(draft.row.id))
			: []
	const assignableGroups = draftGroups.filter(group =>
		assigning.every(draft => groupAcceptsPuzzle(group.row, draft.row)),
	)
	const canDelete = checked.every(deletable)
	const canUnassign = checked.every(draft => !!draft.groupId)
	function startAction(
		kind: 'delete' | 'palette' | 'group' | 'unassign',
		ids: readonly string[],
	) {
		setError('')
		setActionError('')
		setStatus('')
		setBulkPaletteId('')
		setBulkGroupId('')
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
			action.kind === 'group' &&
			!assignableGroups.some(group => group.row.id === bulkGroupId)
		) {
			setActionError('Choose a draft group before assigning puzzles.')
			return
		}
		bulkWorking.current = true
		setBulkBusy(true)
		setActionError('')
		try {
			if (action.kind === 'group') {
				await managePuzzleGroup(client, bulkGroupId, {
					kind: 'append',
					puzzleIds: action.ids,
				})
			} else if (action.kind === 'unassign') {
				// One request per group; a failure part-way leaves earlier groups unassigned.
				const byGroup = new Map<string, string[]>()
				for (const draft of puzzles)
					if (draft.groupId && action.ids.includes(draft.row.id))
						byGroup.set(draft.groupId, [
							...(byGroup.get(draft.groupId) ?? []),
							draft.row.id,
						])
				try {
					for (const [groupId, puzzleIds] of byGroup)
						await managePuzzleGroup(client, groupId, {
							kind: 'remove',
							puzzleIds,
						})
				} catch (cause) {
					invalidate('puzzleDrafts', 'puzzleGroups')
					throw cause
				}
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
					action.kind === 'group'
						? `Assigned ${action.ids.length} draft${action.ids.length === 1 ? '' : 's'} to group.`
						: action.kind === 'unassign'
							? `Unassigned ${action.ids.length} draft${action.ids.length === 1 ? '' : 's'} from their groups.`
							: action.kind === 'delete'
								? `Deleted ${action.ids.length} draft${action.ids.length === 1 ? '' : 's'}.`
								: `Updated the palette for ${action.ids.length} draft${action.ids.length === 1 ? '' : 's'}.`,
				)
				selection.clear()
				invalidate('puzzleDrafts', 'puzzleGroups')
			})
		} catch (cause) {
			setActionError(errorMessage(cause, fallbackError))
		} finally {
			bulkWorking.current = false
			setBulkBusy(false)
		}
	}
	const selectedStatus = selected ? puzzleStatus(selected) : null
	if (selected && selectedStatus === 'published') {
		return (
			<PublishedPuzzleView
				puzzle={selected}
				palettes={palettes}
				onBack={() => setSelectedId(null)}
			/>
		)
	}
	if (selected) {
		const prepared = selectedStatus === 'scheduled'
		const sourceCatalog = prepared ? preparedCatalog : draftCatalog
		return (
			<>
				<AdminFeedback status={status} />
				{prepared && <p>{releaseStateLabel(selected.row)}.</p>}
				<PuzzleDraftEditor
					key={selected.row.id}
					client={client}
					draft={selected}
					palettes={palettes}
					onRefreshPalettes={onRefreshPalettes}
					palettesLoading={palettesLoading}
					palettesRefreshing={palettesRefreshing}
					palettesError={palettesError}
					onCancel={() => setSelectedId(null)}
					onChanged={(status, updated) => {
						setStatus(status)
						sourceCatalog.update(previous =>
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
						// Names, palettes, and designs also appear in group previews.
						invalidate(
							prepared ? 'preparedPuzzles' : 'puzzleDrafts',
							'puzzleGroups',
						)
					}}
				/>
			</>
		)
	}
	return (
		<section aria-labelledby="draft-library-title">
			<AdminSectionHeading
				id="draft-library-title"
				title="Puzzles"
				count={loading || loadFailed ? undefined : visible.length}
			>
				{onNew && canCreate && (
					<AdminIconButton
						icon={faPlusLarge}
						label="New puzzle"
						disabled={bulkBusy}
						onClick={() =>
							onNew(filteredGroup, {
								status: statusFilter,
								purpose: purposeChoice,
								shape: shapeFilter,
								track: trackFilter,
								group: groupChoice,
							})
						}
					/>
				)}
				<AdminIconButton
					icon={faRotate}
					label="Refresh puzzles"
					disabled={loading || bulkBusy}
					onClick={() => {
						selection.clear()
						setAction(null)
						setError('')
						if (showDrafts)
							void draftCatalog.refresh().catch(() => {})
						if (showPrepared)
							void preparedCatalog.refresh().catch(() => {})
					}}
				/>
				<Select
					id="draft-status-filter"
					aria-label="Show status"
					value={statusFilter}
					disabled={bulkBusy}
					onChange={event => {
						setStatusFilter(
							event.target.value as PuzzleStatusFilter,
						)
						setSelectedId(null)
						selection.clear()
						setAction(null)
					}}
				>
					<option value="all">All statuses</option>
					<option value="drafts">Unassigned</option>
					<option value="assigned">Assigned</option>
					<option value="scheduled">Scheduled</option>
					<option value="published">Published</option>
				</Select>
				<Select
					id="draft-shape-filter"
					aria-label="Show shape"
					value={shapeFilter}
					disabled={bulkBusy}
					onChange={event => {
						setShapeFilter(event.target.value)
						setSelectedId(null)
						selection.clear()
						setAction(null)
					}}
				>
					<option value="all">All shapes</option>
					{PUZZLE_SHAPE_IDS.map(shape => (
						<option key={shape} value={shape}>
							{PUZZLE_SHAPE_LABELS[shape]}
						</option>
					))}
				</Select>
				<Select
					id="draft-track-filter"
					aria-label="Show track"
					value={trackFilter}
					disabled={bulkBusy}
					onChange={event => {
						setTrackFilter(event.target.value)
						setSelectedId(null)
						selection.clear()
						setAction(null)
					}}
				>
					<option value="all">All tracks</option>
					<option value="basic">Basic</option>
					<option value="rotation">Rotation</option>
				</Select>
				{showGroupFilters && (
					<>
						<Select
							id="draft-purpose-filter"
							aria-label="Show purpose"
							value={purposeFilter}
							disabled={bulkBusy}
							onChange={event => {
								setPurposeFilter(event.target.value)
								selection.clear()
								setAction(null)
							}}
						>
							<option value="all">All purposes</option>
							{PUZZLE_GROUP_PURPOSES.map(purpose => (
								<option key={purpose} value={purpose}>
									{puzzleGroupPurposeLabels[purpose]}
								</option>
							))}
						</Select>
						<Select
							id="draft-group-filter"
							aria-label="Show group"
							value={shownGroup}
							disabled={bulkBusy}
							onChange={event => {
								setGroupChoice(event.target.value)
								selection.clear()
								setAction(null)
							}}
						>
							<option value="all">All groups</option>
							{statusFilter !== 'assigned' && (
								<option value="none">No group</option>
							)}
							{groupOptions.map(([id, name]) => (
								<option key={id} value={id}>
									{name}
								</option>
							))}
						</Select>
					</>
				)}
			</AdminSectionHeading>
			<AdminFeedback
				error={
					error ||
					(catalogError
						? errorMessage(catalogError, fallbackError)
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
						refreshing
							? 'Refreshing puzzles…'
							: 'Loading puzzles...'
					}
				/>
			) : loadFailed ? null : (
				<>
					<AdminSelectionBar
						label="Bulk draft actions"
						shown={selectable.length}
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
							label="Assign to group"
							title={
								canAssign
									? undefined
									: 'Only unassigned drafts can be assigned to a group.'
							}
							disabled={bulkBusy || !canAssign}
							onClick={() => startAction('group', selection.ids)}
						/>
						{statusFilter !== 'drafts' && (
							<AdminIconButton
								icon={faLinkSlash}
								label="Unassign from groups"
								title={
									canUnassign
										? undefined
										: 'Only drafts in a group can be unassigned.'
								}
								disabled={bulkBusy || !canUnassign}
								onClick={() =>
									startAction('unassign', selection.ids)
								}
							/>
						)}
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
								action.kind === 'group'
									? 'Assign selected puzzles to group'
									: action.kind === 'unassign'
										? 'Unassign selected puzzles'
										: action.kind === 'delete'
											? 'Confirm gallery deletion'
											: 'Change selected palettes'
							}
							closeLabel="Close puzzle action"
							destructive={action.kind === 'delete'}
							confirmLabel={
								action.kind === 'group'
									? 'Assign puzzles'
									: action.kind === 'unassign'
										? 'Unassign puzzles'
										: action.kind === 'delete'
											? 'Confirm delete'
											: 'Apply palette'
							}
							pending={
								bulkBusy
									? action.kind === 'delete'
										? 'Deleting puzzle drafts…'
										: action.kind === 'group'
											? 'Assigning puzzles to group…'
											: action.kind === 'unassign'
												? 'Unassigning puzzles…'
												: 'Updating puzzle palettes…'
									: null
							}
							error={actionError || groupsError}
							confirmDisabled={
								(action.kind === 'palette' &&
									(!bulkPaletteId ||
										palettesLoading ||
										palettesError)) ||
								(action.kind === 'group' &&
									(groupsLoading || !bulkGroupId))
							}
							onConfirm={() => {
								void applyAction()
							}}
							onCancel={() => setAction(null)}
						>
							<p>
								{action.kind === 'group'
									? `Assign ${action.ids.length} drafts to a group?`
									: action.kind === 'unassign'
										? `Remove ${action.ids.length} draft${action.ids.length === 1 ? '' : 's'} from their groups? Designs are unchanged.`
										: action.kind === 'delete'
											? `Permanently delete ${action.ids.length} draft${action.ids.length === 1 ? '' : 's'}?`
											: `Change palette for ${action.ids.length} draft${action.ids.length === 1 ? '' : 's'}?`}
							</p>
							<ul>
								{puzzles
									.filter(draft =>
										action.ids.includes(draft.row.id),
									)
									.map(draft => (
										<li key={draft.row.id}>
											{draft.row.name}
										</li>
									))}
							</ul>
							{action.kind === 'group' &&
								(groupsLoading ? (
									<Loading label="Loading draft groups..." />
								) : (
									<>
										<label htmlFor="bulk-group">
											Draft group
										</label>
										<Select
											id="bulk-group"
											value={bulkGroupId}
											disabled={bulkBusy}
											onChange={event =>
												setBulkGroupId(
													event.target.value,
												)
											}
										>
											<option value="">
												Choose a group
											</option>
											{assignableGroups.map(group => (
												<option
													key={group.row.id}
													value={group.row.id}
												>
													{group.row.name} (
													{
														puzzleGroupPurposeLabels[
															group.purpose
														]
													}
													, {group.members.length}{' '}
													puzzles)
												</option>
											))}
										</Select>
										{!assignableGroups.length &&
											!actionError &&
											!groupsError && (
												<p>
													No draft group accepts all
													of these puzzles. Create a
													group with a matching shape
													and track, or a daily group,
													then select the puzzles
													again.
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
							{action.kind === 'group' && groupsError && (
								<Button
									disabled={groupsLoading || bulkBusy}
									onClick={() => {
										setActionError('')
										setBulkGroupId('')
										void groupCatalog
											.refresh()
											.catch(() => {})
									}}
								>
									Retry loading groups
								</Button>
							)}
						</ConfirmDialog>
					)}
					{!visible.length && (
						<p>
							{inStatus.length
								? 'No puzzles match this view.'
								: statusFilter === 'scheduled'
									? 'No puzzles are scheduled. Groups are scheduled from the Release tab, or from Puzzles > Groups.'
									: statusFilter === 'published'
										? 'No puzzles are live yet.'
										: 'No puzzles match this view.'}
						</p>
					)}
					<AdminGallery layout="puzzles">
						{visible.map(draft => {
							const palette = palettes.find(
								value => value.id === draft.puzzle.paletteId,
							)
							const preview = palette
								? renderAuthoredPuzzle(draft.puzzle, palette)
								: null
							const state = puzzleStatus(draft)
							const released = !isEditable(state)
							return (
								<AdminItemCard
									key={draft.row.id}
									label={`${released ? 'Puzzle' : 'Draft'} ${draft.row.name}`}
									selectLabel={`Select draft ${draft.row.name}`}
									selected={selection.checked.has(
										draft.row.id,
									)}
									selectDisabled={bulkBusy}
									onSelect={
										released
											? undefined
											: value => {
													selection.toggle(
														draft.row.id,
														value,
													)
													setAction(null)
												}
									}
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
											{released && (
												<ReleaseStateIcon
													row={draft.row}
												/>
											)}
											<AdminIconButton
												icon={
													state === 'published'
														? faEye
														: faPenToSquare
												}
												tone="edit"
												disabled={bulkBusy}
												label={
													released
														? `${state === 'scheduled' ? 'Edit' : 'View'} puzzle ${draft.row.name}`
														: `Edit draft ${draft.row.name}`
												}
												title={
													released
														? undefined
														: `Edit ${draft.row.name}`
												}
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
										}
									</span>
									<span>{draft.puzzle.recipe.label}</span>
									<span>
										{draft.groupName ??
											(draft.assigned
												? 'Assigned'
												: 'Unassigned')}
									</span>
									{draft.groupPurpose && (
										<em>
											{
												puzzleGroupPurposeLabels[
													draft.groupPurpose
												]
											}
										</em>
									)}
								</AdminItemCard>
							)
						})}
					</AdminGallery>
				</>
			)}
		</section>
	)
}
