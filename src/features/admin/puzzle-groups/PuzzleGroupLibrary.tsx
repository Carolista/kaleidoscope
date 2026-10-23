import {
	faEye,
	faPenToSquare,
	faPlusLarge,
	faRotate,
	faTrashCan,
} from '@fortawesome/pro-solid-svg-icons'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import {
	managePuzzleGroup,
	puzzleGroupPurposeLabels,
	puzzleGroupTrackLabels,
	purposeHasShape,
	PUZZLE_GROUP_PURPOSES,
	PUZZLE_GROUP_TRACKS,
	type PuzzleGroup,
	type PuzzleGroupAction,
	type PuzzleGroupDetails,
} from '@/features/admin/services'
import type { Database } from '@/lib/supabase'
import { PuzzleBoard } from '@/ui/puzzle'
import {
	isPuzzleShapeId,
	PUZZLE_SHAPE_IDS,
	PUZZLE_SHAPE_LABELS,
} from '@/domain/puzzles'
import {
	AdminIconButton,
	AdminFeedback,
	AdminGallery,
	AdminSectionHeading,
	AdminGroupCard,
	AdminGroupForm,
	errorMessage,
} from '@/features/admin/common'
import { ConfirmDialog, Loading, Select } from '@/ui/components'
import {
	GroupCreationDialog,
	GroupDetailsFields,
	sameGroupDetails,
	SortableGroupMembers,
	useStagedOrder,
	type GroupDetailsValue,
} from '@/features/admin/groups'
import { useModalState } from '@/ui/hooks'
import styles from './PuzzleGroupLibrary.module.css'
import { useUnsavedDraft } from '@/ui/navigation'
import { useCatalog, useCatalogInvalidation } from '@/features/admin/catalog'
import {
	ReleaseActions,
	releaseStateLabel,
	useReleaseDialog,
} from '@/features/admin/release'

type PuzzleGroupDetailsValue = GroupDetailsValue<PuzzleGroup['purpose']>

function shapeLabel(shape: string | null) {
	if (shape === null) return 'All shapes'
	return isPuzzleShapeId(shape) ? PUZZLE_SHAPE_LABELS[shape] : shape
}

function detailsOf(group: PuzzleGroup): PuzzleGroupDetailsValue {
	const shape = group.row.shape_id
	return {
		purpose: group.purpose,
		shape: shape !== null && isPuzzleShapeId(shape) ? shape : 'hexagon',
		track: group.track,
	}
}

function serverDetails(value: PuzzleGroupDetailsValue): PuzzleGroupDetails {
	return {
		purpose: value.purpose,
		shape: purposeHasShape(value.purpose) ? value.shape : null,
		track: value.track,
	}
}

const fallbackError = 'Unable to manage puzzle groups.'

// Applies a successful group action to cached groups without refetching.
function applyAction(
	group: PuzzleGroup,
	action: PuzzleGroupAction,
): PuzzleGroup {
	if (action.kind === 'update')
		return {
			...group,
			row: {
				...group.row,
				name: action.name.trim(),
				purpose: action.details.purpose,
				shape_id: action.details.shape,
				track: action.details.track,
			},
			purpose: action.details.purpose,
			track: action.details.track,
		}
	if (action.kind !== 'reorder' && action.kind !== 'remove') return group
	const members =
		action.kind === 'remove'
			? group.members.filter(
					member => !action.puzzleIds.includes(member.puzzleId),
				)
			: action.puzzleIds.flatMap(id =>
					group.members.filter(member => member.puzzleId === id),
				)
	return {
		...group,
		members: members.map((member, index) => ({
			...member,
			position: index + 1,
		})),
		preview: members[0]?.preview ?? null,
	}
}

export default function PuzzleGroupLibrary({
	client,
}: {
	readonly client: SupabaseClient<Database>
}) {
	const catalog = useCatalog('puzzleGroups', client)
	const invalidate = useCatalogInvalidation()
	const groups: readonly PuzzleGroup[] = catalog.data ?? []
	const loading = catalog.loading
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [creating, setCreating, creationModal] = useModalState<true>()
	const [name, setName] = useState('')
	const [details, setDetails] = useState<PuzzleGroupDetailsValue>({
		purpose: 'core',
		shape: 'hexagon',
		track: 'basic',
	})
	const [purposeFilter, setPurposeFilter] = useState('all')
	const [shapeFilter, setShapeFilter] = useState('all')
	const [trackFilter, setTrackFilter] = useState('all')
	const addButton = useRef<HTMLButtonElement>(null)
	const focusAdd = useRef(false)
	const [pending, setPending] = useState<string | null>(null)
	const busy = pending !== null
	const working = useRef(false)
	const [error, setError] = useState('')
	const [deleteError, setDeleteError] = useState('')
	const [status, setStatus] = useState('')
	const [deleting, setDeleting, deleteModal] = useModalState<PuzzleGroup>()
	const release = useReleaseDialog(client, message => {
		setError('')
		setStatus(message)
	})
	const selected = groups.find(group => group.row.id === selectedId)
	const readOnly = !!selected?.row.published_at || !!selected?.row.release_at
	const order = useStagedOrder(
		selected?.members ?? [],
		member => member.puzzleId,
	)
	const members = order.ordered
	const detailsDirty =
		!!selected && !sameGroupDetails(details, detailsOf(selected), true)
	const nameDirty = !!selected && name.trim() !== selected.row.name
	const dirty =
		!!selected &&
		!readOnly &&
		(name !== selected.row.name || detailsDirty || order.dirty)
	useUnsavedDraft({ dirty, pending: busy })
	useEffect(() => {
		if (!loading && !creating && focusAdd.current) {
			addButton.current?.focus()
			focusAdd.current = false
		}
	}, [loading, creating])
	async function removeGroup() {
		if (!deleting || working.current) return
		working.current = true
		setPending('Deleting puzzle group…')
		setDeleteError('')
		setStatus('')
		try {
			await managePuzzleGroup(client, deleting.row.id, {
				kind: 'delete',
			})
			setStatus(
				`Deleted "${deleting.row.name}". Its puzzles remain in the library.`,
			)
			catalog.update(previous =>
				previous.filter(group => group.row.id !== deleting.row.id),
			)
			invalidate('puzzleDrafts')
			setDeleting(null)
		} catch (cause) {
			setDeleteError(errorMessage(cause, fallbackError))
		} finally {
			working.current = false
			setPending(null)
		}
	}
	async function mutate(
		id: string,
		actions: readonly PuzzleGroupAction[],
		success: string,
	) {
		if (working.current || !actions.length) return
		working.current = true
		setPending('Saving puzzle group…')
		setError('')
		setStatus('')
		try {
			for (const action of actions) {
				await managePuzzleGroup(client, id, action)
				catalog.update(previous =>
					previous.map(group =>
						group.row.id === id
							? applyAction(group, action)
							: group,
					),
				)
				if (action.kind === 'update') setName(action.name.trim())
				if (action.kind === 'remove') order.drop(action.puzzleIds)
				// Group names, purposes, and membership appear in the puzzle catalog.
				if (action.kind === 'update' || action.kind === 'remove')
					invalidate('puzzleDrafts')
			}
			setStatus(success)
		} catch (cause) {
			setError(errorMessage(cause, fallbackError))
		} finally {
			working.current = false
			setPending(null)
		}
	}
	function save() {
		if (!selected || readOnly) return
		if (!name.trim()) {
			setError('Enter a group name.')
			return
		}
		void mutate(
			selected.row.id,
			[
				...(nameDirty || detailsDirty
					? [
							{
								kind: 'update',
								name,
								details: serverDetails(details),
							} as const,
						]
					: []),
				...(order.dirty
					? [
							{
								kind: 'reorder',
								puzzleIds: members.map(
									member => member.puzzleId,
								),
							} as const,
						]
					: []),
			],
			'Group saved.',
		)
	}
	const shown = groups.filter(
		group =>
			(purposeFilter === 'all' || group.purpose === purposeFilter) &&
			(shapeFilter === 'all' ||
				(shapeFilter === 'none'
					? group.row.shape_id === null
					: group.row.shape_id === shapeFilter)) &&
			(trackFilter === 'all' ||
				(trackFilter === 'none'
					? group.track === null
					: group.track === trackFilter)),
	)
	return (
		<section aria-labelledby="puzzle-groups-title">
			<AdminSectionHeading
				id="puzzle-groups-title"
				title={
					selected
						? `Group: ${selected.row.name}${readOnly ? ' (read-only)' : ''}`
						: 'Puzzle groups'
				}
			>
				{selected && (
					<ReleaseActions
						kind="puzzle_group"
						id={selected.row.id}
						name={selected.row.name}
						row={selected.row}
						slot={selected.row}
						disabled={busy || dirty}
						onStart={release.start}
					/>
				)}
				{!selected && (
					<>
						<AdminIconButton
							icon={faPlusLarge}
							label="New group"
							ref={addButton}
							disabled={busy || loading || !!deleting}
							onClick={() => {
								setCreating(true)
								setStatus('')
								setError('')
							}}
						/>
						<AdminIconButton
							icon={faRotate}
							label="Refresh groups"
							disabled={busy || loading || !!deleting}
							onClick={() => {
								setError('')
								void catalog.refresh().catch(() => {})
							}}
						/>
						<Select
							id="group-purpose-filter"
							aria-label="Show purpose"
							value={purposeFilter}
							onChange={event =>
								setPurposeFilter(event.target.value)
							}
						>
							<option value="all">All purposes</option>
							{PUZZLE_GROUP_PURPOSES.map(purpose => (
								<option key={purpose} value={purpose}>
									{puzzleGroupPurposeLabels[purpose]}
								</option>
							))}
						</Select>
						<Select
							id="group-shape-filter"
							aria-label="Show shape"
							value={shapeFilter}
							onChange={event =>
								setShapeFilter(event.target.value)
							}
						>
							<option value="all">All shapes</option>
							{PUZZLE_SHAPE_IDS.map(shape => (
								<option key={shape} value={shape}>
									{PUZZLE_SHAPE_LABELS[shape]}
								</option>
							))}
							<option value="none">Mixed shapes (daily)</option>
						</Select>
						<Select
							id="group-track-filter"
							aria-label="Show track"
							value={trackFilter}
							onChange={event =>
								setTrackFilter(event.target.value)
							}
						>
							<option value="all">All tracks</option>
							{PUZZLE_GROUP_TRACKS.map(track => (
								<option key={track} value={track}>
									{puzzleGroupTrackLabels[track]}
								</option>
							))}
							<option value="none">No track</option>
						</Select>
					</>
				)}
			</AdminSectionHeading>
			<AdminFeedback
				error={
					error ||
					(catalog.error
						? errorMessage(catalog.error, fallbackError)
						: '')
				}
				status={status}
			/>
			{creating && (
				<GroupCreationDialog
					{...creationModal}
					title="New puzzle group"
					formLabel="Create puzzle group"
					purposes={puzzleGroupPurposeLabels}
					initialPurpose="core"
					puzzleDetails
					confirmLabel="Create group"
					pendingLabel="Creating puzzle group…"
					onCancel={() => setCreating(null)}
					onCreate={async (id, name, value) => {
						await managePuzzleGroup(client, id, {
							kind: 'create',
							name,
							details: serverDetails(value),
						})
						focusAdd.current = true
						setCreating(null)
						setStatus('Puzzle group created.')
						void catalog.refresh().catch(() => {})
					}}
				/>
			)}
			{deleting && (
				<ConfirmDialog
					{...deleteModal}
					title="Confirm group deletion"
					closeLabel="Close group deletion"
					destructive
					message={`Delete "${deleting.row.name}"? Its ${deleting.members.length} puzzles will be unassigned, not deleted.`}
					confirmLabel="Confirm delete group"
					cancelLabel="Keep group"
					pending={pending}
					error={deleteError}
					onConfirm={() => {
						void removeGroup()
					}}
					onCancel={() => setDeleting(null)}
				>
					<ul>
						{deleting.members.map(member => (
							<li key={member.puzzleId}>{member.name}</li>
						))}
					</ul>
				</ConfirmDialog>
			)}
			{loading ? (
				<Loading
					label={
						catalog.refreshing
							? 'Refreshing puzzle groups…'
							: 'Loading puzzle groups...'
					}
				/>
			) : selected ? (
				<>
					<AdminGroupForm
						label="Puzzle group details"
						nameId="group-name"
						name={name}
						disabled={busy}
						readOnly={readOnly}
						saveDisabled={
							!nameDirty && !detailsDirty && !order.dirty
						}
						onNameChange={setName}
						onSave={save}
					>
						<GroupDetailsFields
							idPrefix="group-details"
							purposes={puzzleGroupPurposeLabels}
							value={details}
							puzzleDetails
							disabled={busy || readOnly}
							onChange={setDetails}
						/>
					</AdminGroupForm>
					{!selected.members.length && <p>No puzzles yet.</p>}
					<SortableGroupMembers
						members={members.map(member => ({
							...member,
							id: member.puzzleId,
						}))}
						noun="puzzles"
						disabled={busy || readOnly}
						preview={member => (
							<div
								className={styles.groupMemberThumbnail}
								aria-hidden="true"
							>
								{member.preview ? (
									<PuzzleBoard
										target
										shape={member.preview.shape}
										gridSize={member.preview.gridSize}
										colors={member.preview.target}
									/>
								) : (
									<span>Preview unavailable</span>
								)}
							</div>
						)}
						onReorder={order.setOrder}
						onRemove={puzzleId => {
							void mutate(
								selected.row.id,
								[{ kind: 'remove', puzzleIds: [puzzleId] }],
								'Puzzle removed from group.',
							)
						}}
					>
						{(member, index) => (
							<>
								{index + 1}. {member.name}
							</>
						)}
					</SortableGroupMembers>
				</>
			) : !groups.length ? (
				!error && !catalog.error && <p>No puzzle groups yet.</p>
			) : !shown.length ? (
				<p>No puzzle groups match these filters.</p>
			) : (
				<AdminGallery layout="groups">
					{shown.map(group => (
						<AdminGroupCard
							key={group.row.id}
							label={`Group ${group.row.name}`}
							thumbnail={
								group.preview ? (
									<PuzzleBoard
										target
										shape={group.preview.shape}
										gridSize={group.preview.gridSize}
										colors={group.preview.target}
									/>
								) : (
									<span>
										{group.members.length
											? 'Preview unavailable'
											: 'Empty group'}
									</span>
								)
							}
							actions={
								<>
									<ReleaseActions
										kind="puzzle_group"
										id={group.row.id}
										name={group.row.name}
										row={group.row}
										slot={group.row}
										disabled={busy || !!deleting}
										onStart={release.start}
									/>
									<AdminIconButton
										icon={
											group.row.published_at ||
											group.row.release_at
												? faEye
												: faPenToSquare
										}
										label={`${group.row.published_at || group.row.release_at ? 'View' : 'Edit'} group ${group.row.name}`}
										tone="edit"
										disabled={busy || !!deleting}
										onClick={() => {
											setSelectedId(group.row.id)
											setName(group.row.name)
											setDetails(detailsOf(group))
											order.reset()
											setStatus('')
											setError('')
										}}
									/>
									<AdminIconButton
										icon={faTrashCan}
										label={`Delete group ${group.row.name}`}
										tone="delete"
										disabled={
											busy ||
											!!deleting ||
											!!group.row.published_at ||
											!!group.row.release_at
										}
										onClick={() => {
											setDeleting(group)
											setDeleteError('')
											setStatus('')
										}}
									/>
								</>
							}
						>
							<strong>{group.row.name}</strong>
							<span>
								{puzzleGroupPurposeLabels[group.purpose]} ·{' '}
								{shapeLabel(group.row.shape_id)}
								{group.track
									? ` · ${puzzleGroupTrackLabels[group.track]}`
									: ''}
							</span>
							<span>
								{group.members.length}{' '}
								{group.members.length === 1
									? 'puzzle'
									: 'puzzles'}
							</span>
							{releaseStateLabel(group.row) && (
								<span>{releaseStateLabel(group.row)}</span>
							)}
						</AdminGroupCard>
					))}
				</AdminGallery>
			)}
			{release.dialog}
			{pending && !deleting && <Loading label={pending} />}
		</section>
	)
}
