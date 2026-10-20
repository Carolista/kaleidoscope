import { useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
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
import PuzzleDraftEditor from './PuzzleDraftEditor'
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

// Only unassigned drafts may be deleted, singly or in bulk.
function deletable(draft: LibraryDraft) {
	return !draft.assigned && !draft.row.published_at && !draft.row.release_at
}

export interface LibraryView {
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
	catalogStatus,
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
	const [purposeFilter, setPurposeFilter] = useState(
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
	const groupFilterActive =
		catalogStatus === 'assigned' &&
		groupChoice !== 'all' &&
		groupChoice !== 'none'
	const groupCatalog = useCatalog(
		'puzzleGroups',
		client,
		action?.kind === 'group' || groupFilterActive,
	)
	const draftGroups: readonly PuzzleGroup[] = groupCatalog.data ?? []
	const groupsLoading = groupCatalog.loading
	const groupsError =
		action?.kind === 'group' && groupCatalog.error
			? errorMessage(groupCatalog.error, fallbackError)
			: ''
	const selected = drafts.find(value => value.row.id === selectedId)
	const inStatus = drafts.filter(
		value =>
			!catalogStatus ||
			(!value.row.published_at &&
				!value.row.release_at &&
				value.assigned === (catalogStatus === 'assigned')),
	)
	// Unassigned drafts never belong to a group, so only offer those filters elsewhere.
	const showGroupFilters = catalogStatus !== 'drafts'
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
		groupChoice === 'all' ||
		groupChoice === 'none' ||
		groupOptions.some(([id]) => id === groupChoice)
			? groupChoice
			: 'all'
	// New puzzles join the filtered group when it is still an editable draft.
	const filteredGroup = groupFilterActive
		? draftGroups.find(
				group => group.row.id === shownGroup && !group.row.release_at,
			)
		: undefined
	const canCreate = catalogStatus !== 'assigned' || !!filteredGroup
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
	const visible =
		catalogStatus === 'assigned'
			? [...filtered].sort((a, b) =>
					compareGroupOrder(groupOrderKey(a), groupOrderKey(b)),
				)
			: filtered
	const selection = useCheckedIds(visible.map(draft => draft.row.id))
	const checked = visible.filter(draft => selection.checked.has(draft.row.id))
	// Groups accept only puzzles matching their shape and track, so the choices depend on the batch.
	const canAssign = checked.every(draft => !draft.assigned)
	const assigning =
		action?.kind === 'group'
			? drafts.filter(draft => action.ids.includes(draft.row.id))
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
				for (const draft of drafts)
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
					onCancel={() => setSelectedId(null)}
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
						// Names, palettes, and designs also appear in group previews.
						invalidate('puzzleDrafts', 'puzzleGroups')
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
				{onNew && canCreate && (
					<AdminIconButton
						icon={faPlusLarge}
						label="New puzzle"
						disabled={bulkBusy}
						onClick={() =>
							onNew(filteredGroup, {
								purpose: purposeFilter,
								shape: shapeFilter,
								track: trackFilter,
								group: groupChoice,
							})
						}
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
							{catalogStatus !== 'assigned' && (
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
							label="Assign to group"
							title={
								canAssign
									? undefined
									: 'Only unassigned drafts can be assigned to a group.'
							}
							disabled={bulkBusy || !canAssign}
							onClick={() => startAction('group', selection.ids)}
						/>
						{catalogStatus !== 'drafts' && (
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
										{draft.groupPurpose
											? `${puzzleGroupPurposeLabels[draft.groupPurpose]} · `
											: ''}
										{draft.groupName ??
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
