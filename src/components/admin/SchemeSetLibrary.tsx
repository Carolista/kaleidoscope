import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
	faPenToSquare,
	faPlusLarge,
	faRotate,
	faTrashCan,
} from '@fortawesome/pro-solid-svg-icons'
import {
	Button,
	ConfirmDialog,
	FormField,
	Loading,
	PaletteStrip,
	Select,
} from '@shared'
import {
	AdminFeedback,
	AdminGallery,
	AdminSectionHeading,
	AdminSetCard,
	AdminSetForm,
} from './AdminLayout'
import SortableSetMembers from './SortableSetMembers'
import SetCreationDialog from './SetCreationDialog'
import useModalState from '../../hooks/useModalState'
import type { Database } from '../../types/database'
import {
	manageSchemeSet,
	schemeSetLabels,
	type SchemeSet,
	type SchemeSetAction,
	type SchemeSetKind,
} from '../../services/schemeSets'
import AdminIconButton from './AdminIconButton'
import useUnsavedDraft from './useUnsavedDraft'
import useStagedOrder from './useStagedOrder'
import adminStyles from './AdminPortal.module.css'

function errorMessage(cause: unknown) {
	return cause instanceof Error
		? cause.message
		: 'Unable to manage palette sets.'
}

export default function SchemeSetLibrary({
	client,
	sets,
	loading,
	refreshing = false,
	catalogError,
	onChanged,
	onOrderSaved,
}: {
	readonly client: SupabaseClient<Database>
	readonly sets: readonly SchemeSet[]
	readonly loading: boolean
	readonly refreshing?: boolean
	readonly catalogError: string
	readonly onChanged: () => void
	readonly onOrderSaved: (
		setId: string,
		paletteIds: readonly string[],
	) => void
}) {
	const [editing, setEditing] = useState<{
		id: string
		name: string
		kind: SchemeSetKind
	} | null>(null)
	const [name, setName] = useState('')
	const [creating, setCreating, creationModal] = useModalState<true>()
	const addButton = useRef<HTMLButtonElement>(null)
	const focusAdd = useRef(false)
	const [kind, setKind] = useState<SchemeSetKind>('undecided')
	const [error, setError] = useState('')
	const [deleteError, setDeleteError] = useState('')
	const [status, setStatus] = useState('')
	const [busy, setBusy] = useState(false)
	const [deleting, setDeleting, deleteModal] = useModalState<SchemeSet>()
	const working = useRef(false)
	const selected = sets.find(set => set.row.id === editing?.id)
	const readOnly = !!selected?.row.published_at || !!selected?.row.release_at
	const unavailable = busy || loading || !!catalogError
	const order = useStagedOrder(selected?.members ?? [], member => member.id)
	const members = order.ordered
	const detailsDirty =
		!!editing && (name.trim() !== editing.name || kind !== editing.kind)
	const dirty =
		!!editing &&
		!readOnly &&
		(name !== editing.name || kind !== editing.kind || order.dirty)
	useUnsavedDraft({ dirty, pending: busy })
	useEffect(() => {
		if (!loading && !creating && focusAdd.current) {
			addButton.current?.focus()
			focusAdd.current = false
		}
	}, [loading, creating])
	async function mutate(
		id: string,
		actions: readonly SchemeSetAction[],
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
				await manageSchemeSet(client, id, action)
				if (action.kind === 'reorder')
					onOrderSaved(id, action.paletteIds)
				else changed = true
				if (action.kind === 'update') {
					setEditing({
						id,
						name: action.name.trim(),
						kind: action.role,
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
			;(deleteAction ? setDeleteError : setError)(errorMessage(cause))
		} finally {
			working.current = false
			setBusy(false)
			// Detail, membership, and deletion changes reload the set catalog.
			if (changed) onChanged()
		}
	}
	function save() {
		if (!editing || !name.trim() || readOnly) return
		void mutate(
			editing.id,
			[
				...(detailsDirty
					? [{ kind: 'update', name, role: kind } as const]
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
			'Set saved.',
		)
	}
	return (
		<section aria-labelledby="scheme-sets-title">
			<AdminSectionHeading
				id="scheme-sets-title"
				title={
					editing
						? `Palette set: ${editing.name}${readOnly ? ' (read-only)' : ''}`
						: 'Palette sets'
				}
			>
				{!editing && (
					<>
						<AdminIconButton
							icon={faPlusLarge}
							label="New palette set"
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
							label="Refresh palette sets"
							disabled={busy || loading || !!deleting}
							onClick={() => {
								setError('')
								onChanged()
							}}
						/>
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
						Retry loading sets
					</Button>
				</p>
			)}
			<AdminFeedback status={status} />
			{!editing && !loading && !catalogError && sets.length === 0 && (
				<p>No palette sets yet.</p>
			)}
			{creating && (
				<SetCreationDialog
					{...creationModal}
					title="New palette set"
					formLabel="Palette set details"
					kindLabel="Set label"
					kinds={schemeSetLabels}
					initialKind="undecided"
					confirmLabel="Save set"
					pendingLabel="Creating palette set…"
					onCancel={() => setCreating(null)}
					onCreate={async (id, name, kind) => {
						await manageSchemeSet(client, id, {
							kind: 'create',
							name,
							role: kind,
						})
						focusAdd.current = true
						setCreating(null)
						setStatus('Palette set created.')
						onChanged()
					}}
				/>
			)}
			{editing ? (
				<>
					<AdminSetForm
						label="Palette set details"
						nameId="scheme-set-name"
						name={name}
						disabled={unavailable}
						readOnly={readOnly}
						saveDisabled={!detailsDirty && !order.dirty}
						onNameChange={setName}
						onSave={save}
					>
						<FormField label="Set label" id="scheme-set-kind">
							{field => (
								<Select
									{...field}
									value={kind}
									disabled={unavailable || readOnly}
									onChange={event => {
										const value = event.target.value
										if (
											value === 'undecided' ||
											value === 'core' ||
											value === 'reward' ||
											value === 'paid'
										)
											setKind(value)
									}}
								>
									{Object.entries(schemeSetLabels).map(
										([value, label]) => (
											<option key={value} value={value}>
												{label}
											</option>
										),
									)}
								</Select>
							)}
						</FormField>
					</AdminSetForm>
					{selected && (
						<>
							{selected.members.length === 0 && (
								<p>No palettes yet.</p>
							)}
							<SortableSetMembers
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
							</SortableSetMembers>
						</>
					)}
				</>
			) : (
				<AdminGallery layout="sets">
					{sets.map(set => (
						<AdminSetCard
							key={set.row.id}
							label={`Palette set ${set.row.name}`}
							thumbnail={
								set.members.length === 0
									? 'Empty set'
									: set.members
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
									<AdminIconButton
										icon={faPenToSquare}
										label={`Edit set ${set.row.name}`}
										className={adminStyles.editAction}
										disabled={unavailable || !!deleting}
										onClick={() => {
											setEditing({
												id: set.row.id,
												name: set.row.name,
												kind: set.kind,
											})
											setName(set.row.name)
											setKind(set.kind)
											order.reset()
											setStatus('')
											setError('')
										}}
									/>
									<AdminIconButton
										icon={faTrashCan}
										label={`Delete set ${set.row.name}`}
										className={adminStyles.deleteAction}
										disabled={
											unavailable ||
											!!deleting ||
											!!set.row.published_at ||
											!!set.row.release_at
										}
										onClick={() => {
											setDeleteError('')
											setDeleting(set)
										}}
									/>
								</>
							}
						>
							<strong>{set.row.name}</strong>
							<span>{schemeSetLabels[set.kind]}</span>
							<span>
								{set.members.length}{' '}
								{set.members.length === 1
									? 'palette'
									: 'palettes'}
							</span>
						</AdminSetCard>
					))}
				</AdminGallery>
			)}
			{deleting && (
				<ConfirmDialog
					{...deleteModal}
					title="Confirm palette set deletion"
					closeLabel="Close palette set deletion"
					destructive
					message={`Delete "${deleting.row.name}"? Its ${deleting.members.length} palettes will remain in the library, ungrouped.`}
					confirmLabel="Confirm delete set"
					cancelLabel="Cancel deletion"
					confirmDisabled={loading || !!catalogError}
					pending={busy ? 'Deleting palette set…' : null}
					error={deleteError}
					onConfirm={() => {
						void mutate(
							deleting.row.id,
							[{ kind: 'delete' }],
							'Set deleted. Its palettes remain in the library.',
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
			{busy && !deleting && <Loading label="Saving palette set…" />}
			{loading && (
				<Loading
					label={
						refreshing
							? 'Refreshing palette sets…'
							: 'Loading palette sets…'
					}
				/>
			)}
		</section>
	)
}
