import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
	faEye,
	faPenToSquare,
	faPlusLarge,
	faRotate,
	faTrashCan,
} from '@fortawesome/pro-solid-svg-icons'
import {
	Button,
	ConfirmDialog,
	Loading,
	PaletteStrip,
	Select,
} from '@/ui/components'
import {
	AdminFeedback,
	AdminGallery,
	AdminSectionHeading,
	AdminGroupCard,
	AdminGroupForm,
	AdminIconButton,
	errorMessage,
} from '@/features/admin/common'
import {
	SortableGroupMembers,
	GroupCreationDialog,
	GroupDetailsFields,
	useStagedOrder,
} from '@/features/admin/groups'
import { useModalState } from '@/ui/hooks'
import type { Database } from '@/lib/supabase'
import {
	managePaletteGroup,
	paletteGroupPurposeLabels,
	paletteProgress,
	releaseStateOf,
	PALETTE_GROUP_PURPOSES,
	type PaletteGroup,
	type PaletteGroupAction,
	type PaletteGroupPurpose,
} from '@/features/admin/services'
import { useCatalog } from '@/features/admin/catalog'
import { useUnsavedDraft } from '@/ui/navigation'
import {
	ReleaseActions,
	releaseStateLabel,
	RewardGroupMark,
	useReleaseDialog,
} from '@/features/admin/release'

const fallbackError = 'Unable to manage palette groups.'

export default function PaletteGroupLibrary({
	client,
	groups,
	loading,
	refreshing = false,
	catalogError,
	onChanged,
	onOrderSaved,
}: {
	readonly client: SupabaseClient<Database>
	readonly groups: readonly PaletteGroup[]
	readonly loading: boolean
	readonly refreshing?: boolean
	readonly catalogError: string
	readonly onChanged: () => void
	readonly onOrderSaved: (
		groupId: string,
		paletteIds: readonly string[],
	) => void
}) {
	const [editing, setEditing] = useState<{
		id: string
		name: string
		purpose: PaletteGroupPurpose
	} | null>(null)
	const [name, setName] = useState('')
	const [creating, setCreating, creationModal] = useModalState<true>()
	const addButton = useRef<HTMLButtonElement>(null)
	const focusAdd = useRef(false)
	const [purpose, setPurpose] = useState<PaletteGroupPurpose>('undecided')
	const [purposeFilter, setPurposeFilter] = useState('all')
	const [error, setError] = useState('')
	const [deleteError, setDeleteError] = useState('')
	const [status, setStatus] = useState('')
	const [busy, setBusy] = useState(false)
	const [deleting, setDeleting, deleteModal] = useModalState<PaletteGroup>()
	const release = useReleaseDialog(client, message => {
		setError('')
		setStatus(message)
	})
	const working = useRef(false)
	const paletteCatalog = useCatalog('palettes', client)
	const paletteStates = new Map(
		(paletteCatalog.data ?? []).map(palette => [palette.id, palette]),
	)
	// Reward palettes are released with what awards them, so their group has no release buttons.
	function releaseControls(group: PaletteGroup, disabled: boolean) {
		return group.purpose === 'reward' ? (
			<RewardGroupMark
				progress={paletteProgress([group], paletteStates)}
			/>
		) : (
			<ReleaseActions
				kind="palette_group"
				id={group.row.id}
				name={group.row.name}
				row={group.row}
				disabled={disabled}
				onStart={release.start}
			/>
		)
	}
	const selected = groups.find(group => group.row.id === editing?.id)
	const readOnly = !!selected?.row.published_at || !!selected?.row.release_at
	const unavailable = busy || loading || !!catalogError
	const order = useStagedOrder(selected?.members ?? [], member => member.id)
	const members = order.ordered
	const detailsDirty =
		!!editing &&
		(name.trim() !== editing.name || purpose !== editing.purpose)
	const dirty =
		!!editing &&
		!readOnly &&
		(name !== editing.name || purpose !== editing.purpose || order.dirty)
	useUnsavedDraft({ dirty, pending: busy })
	const shown = groups.filter(
		group => purposeFilter === 'all' || group.purpose === purposeFilter,
	)
	useEffect(() => {
		if (!loading && !creating && focusAdd.current) {
			addButton.current?.focus()
			focusAdd.current = false
		}
	}, [loading, creating])
	async function mutate(
		id: string,
		actions: readonly PaletteGroupAction[],
		message: string,
	) {
		if (working.current || loading || catalogError || !actions.length)
			return
		const deleteAction = actions.some(action => action.kind === 'delete')
		working.current = true
		setBusy(true)
		if (deleteAction) setDeleteError('')
		else setError('')
		setStatus('')
		let changed = false
		try {
			for (const action of actions) {
				await managePaletteGroup(client, id, action)
				if (action.kind === 'reorder')
					onOrderSaved(id, action.paletteIds)
				else changed = true
				if (action.kind === 'update') {
					setEditing({
						id,
						name: action.name.trim(),
						purpose: action.purpose,
					})
					setName(action.name.trim())
				}
				if (action.kind === 'delete') {
					setDeleting(null)
					setEditing(null)
					order.reset()
				}
				if (action.kind === 'remove') order.drop(action.paletteIds)
			}
			setStatus(message)
		} catch (cause) {
			;(deleteAction ? setDeleteError : setError)(
				errorMessage(cause, fallbackError),
			)
		} finally {
			working.current = false
			setBusy(false)
			// Detail, membership, and deletion changes reload the group catalog.
			if (changed) onChanged()
		}
	}
	function save() {
		if (!editing || !name.trim() || readOnly) return
		void mutate(
			editing.id,
			[
				...(detailsDirty
					? [{ kind: 'update', name, purpose } as const]
					: []),
				...(order.dirty
					? [
							{
								kind: 'reorder',
								paletteIds: members.map(member => member.id),
							} as const,
						]
					: []),
			],
			'Group saved.',
		)
	}
	return (
		<section aria-labelledby="palette-groups-title">
			<AdminSectionHeading
				id="palette-groups-title"
				title={
					editing
						? `Palette group: ${editing.name}${readOnly ? ' (read-only)' : ''}`
						: 'Palette groups'
				}
			>
				{selected && releaseControls(selected, unavailable || dirty)}
				{!editing && (
					<>
						<AdminIconButton
							icon={faPlusLarge}
							label="New palette group"
							ref={addButton}
							disabled={unavailable || !!deleting}
							onClick={() => {
								setCreating(true)
								setError('')
								setStatus('')
							}}
						/>
						<AdminIconButton
							icon={faRotate}
							label="Refresh palette groups"
							disabled={busy || loading || !!deleting}
							onClick={() => {
								setError('')
								onChanged()
							}}
						/>
						<Select
							id="palette-group-purpose-filter"
							aria-label="Show purpose"
							value={purposeFilter}
							onChange={event =>
								setPurposeFilter(event.target.value)
							}
						>
							<option value="all">All purposes</option>
							{PALETTE_GROUP_PURPOSES.map(value => (
								<option key={value} value={value}>
									{paletteGroupPurposeLabels[value]}
								</option>
							))}
						</Select>
					</>
				)}
			</AdminSectionHeading>
			<AdminFeedback error={error} />
			{catalogError && (
				<p role="alert">
					{catalogError}{' '}
					<Button
						type="button"
						disabled={loading || busy}
						onClick={onChanged}
					>
						Retry loading groups
					</Button>
				</p>
			)}
			<AdminFeedback status={status} />
			{!editing && !loading && !catalogError && groups.length === 0 && (
				<p>No palette groups yet.</p>
			)}
			{!editing &&
				!loading &&
				!catalogError &&
				groups.length > 0 &&
				shown.length === 0 && (
					<p>No palette groups match this purpose.</p>
				)}
			{creating && (
				<GroupCreationDialog
					{...creationModal}
					title="New palette group"
					formLabel="Palette group details"
					purposes={paletteGroupPurposeLabels}
					initialPurpose="undecided"
					confirmLabel="Save group"
					pendingLabel="Creating palette group…"
					onCancel={() => setCreating(null)}
					onCreate={async (id, name, value) => {
						await managePaletteGroup(client, id, {
							kind: 'create',
							name,
							purpose: value.purpose,
						})
						focusAdd.current = true
						setCreating(null)
						setStatus('Palette group created.')
						onChanged()
					}}
				/>
			)}
			{editing ? (
				<>
					<AdminGroupForm
						label="Palette group details"
						nameId="palette-group-name"
						name={name}
						disabled={unavailable}
						readOnly={readOnly}
						saveDisabled={!detailsDirty && !order.dirty}
						onNameChange={setName}
						onSave={save}
					>
						<GroupDetailsFields
							idPrefix="palette-group-details"
							purposes={paletteGroupPurposeLabels}
							value={{ purpose, shape: 'hexagon', track: null }}
							puzzleDetails={false}
							disabled={unavailable || readOnly}
							onChange={value => setPurpose(value.purpose)}
						/>
					</AdminGroupForm>
					{selected && (
						<>
							{selected.members.length === 0 && (
								<p>No palettes yet.</p>
							)}
							<SortableGroupMembers
								members={members}
								noun="palettes"
								disabled={unavailable || readOnly}
								onReorder={order.setOrder}
								onRemove={paletteId => {
									void mutate(
										selected.row.id,
										[
											{
												kind: 'remove',
												paletteIds: [paletteId],
											},
										],
										'Palette removed; its design is unchanged.',
									)
								}}
							>
								{member => (
									<>
										<PaletteStrip
											colors={member.colors}
											variant="continuous"
										/>
										{member.name}
									</>
								)}
							</SortableGroupMembers>
						</>
					)}
				</>
			) : (
				<AdminGallery layout="groups">
					{shown.map(group => (
						<AdminGroupCard
							key={group.row.id}
							label={`Palette group ${group.row.name}`}
							thumbnail={
								group.members.length === 0
									? 'Empty group'
									: group.members
											.slice(0, 3)
											.map(member => (
												<PaletteStrip
													key={member.id}
													colors={member.colors}
													variant="continuous"
												/>
											))
							}
							actions={
								<>
									{releaseControls(
										group,
										unavailable || !!deleting,
									)}
									<AdminIconButton
										icon={
											group.row.published_at ||
											group.row.release_at
												? faEye
												: faPenToSquare
										}
										label={`${group.row.published_at || group.row.release_at ? 'View' : 'Edit'} group ${group.row.name}`}
										tone="edit"
										disabled={unavailable || !!deleting}
										onClick={() => {
											setEditing({
												id: group.row.id,
												name: group.row.name,
												purpose: group.purpose,
											})
											setName(group.row.name)
											setPurpose(group.purpose)
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
											unavailable ||
											!!deleting ||
											!!group.row.published_at ||
											!!group.row.release_at
										}
										onClick={() => {
											setDeleteError('')
											setDeleting(group)
										}}
									/>
								</>
							}
						>
							<strong>{group.row.name}</strong>
							<em>{paletteGroupPurposeLabels[group.purpose]}</em>
							<span>
								{group.members.length}{' '}
								{group.members.length === 1
									? 'palette'
									: 'palettes'}
							</span>
							{releaseStateOf(group.row) === 'scheduled' && (
								<span>{releaseStateLabel(group.row)}</span>
							)}
						</AdminGroupCard>
					))}
				</AdminGallery>
			)}
			{deleting && (
				<ConfirmDialog
					{...deleteModal}
					title="Confirm palette group deletion"
					closeLabel="Close palette group deletion"
					destructive
					message={`Delete "${deleting.row.name}"? Its ${deleting.members.length} palettes will remain in the library, ungrouped.`}
					confirmLabel="Confirm delete group"
					cancelLabel="Cancel deletion"
					confirmDisabled={loading || !!catalogError}
					pending={busy ? 'Deleting palette group…' : null}
					error={deleteError}
					onConfirm={() => {
						void mutate(
							deleting.row.id,
							[{ kind: 'delete' }],
							'Group deleted. Its palettes remain in the library.',
						)
					}}
					onCancel={() => setDeleting(null)}
				>
					<ul>
						{deleting.members.map(member => (
							<li key={member.id}>{member.name}</li>
						))}
					</ul>
				</ConfirmDialog>
			)}
			{release.dialog}
			{busy && !deleting && <Loading label="Saving palette group…" />}
			{loading && (
				<Loading
					label={
						refreshing
							? 'Refreshing palette groups…'
							: 'Loading palette groups…'
					}
				/>
			)}
		</section>
	)
}
