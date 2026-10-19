import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
	faArrowDown,
	faArrowUp,
	faPenToSquare,
	faPlusLarge,
	faSquareArrowLeft,
	faSquareMinus,
	faTrashCan,
} from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	Button,
	ConfirmDialog,
	FormField,
	Input,
	Loading,
	PaletteStrip,
	Select,
} from '@shared'
import {
	AdminFeedback,
	AdminGallery,
	AdminMemberList,
	AdminMemberRow,
	AdminSectionHeading,
} from './AdminLayout'
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
import { useNavigationGuard } from './useNavigationGuard'
import adminStyles from './AdminPortal.module.css'

export default function SchemeSetLibrary({
	client,
	sets,
	loading,
	refreshing = false,
	catalogError,
	onBack,
	onChanged,
}: {
	readonly client: SupabaseClient<Database>
	readonly sets: readonly SchemeSet[]
	readonly loading: boolean
	readonly refreshing?: boolean
	readonly catalogError: string
	readonly onBack?: () => void
	readonly onChanged: () => void
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
	const dirty =
		!!editing &&
		!readOnly &&
		(name !== editing.name || kind !== editing.kind)
	useUnsavedDraft({ dirty, pending: busy })
	const { requestNavigation } = useNavigationGuard()
	useEffect(() => {
		if (!loading && !creating && focusAdd.current) {
			addButton.current?.focus()
			focusAdd.current = false
		}
	}, [loading, creating])
	function back() {
		requestNavigation(() => {
			if (editing) {
				setEditing(null)
				setError('')
				setStatus('')
			} else onBack?.()
		})
	}
	async function mutate(
		id: string,
		action: SchemeSetAction,
		message: string,
	) {
		if (working.current || loading || catalogError) return
		working.current = true
		setBusy(true)
		if (action.kind === 'delete') setDeleteError('')
		else setError('')
		setStatus('')
		try {
			await manageSchemeSet(client, id, action)
			if (action.kind === 'update') {
				setEditing({ id, name: action.name.trim(), kind: action.role })
				setName(action.name.trim())
			}
			if (action.kind === 'delete') {
				setDeleting(null)
				setEditing(null)
			}
			setStatus(message)
			onChanged()
		} catch (cause) {
			const report = action.kind === 'delete' ? setDeleteError : setError
			report(
				cause instanceof Error
					? cause.message
					: 'Unable to manage palette sets.',
			)
		} finally {
			working.current = false
			setBusy(false)
		}
	}
	function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!editing || !name.trim() || readOnly) return
		void mutate(
			editing.id,
			{ kind: 'update', name, role: kind },
			'Set details saved.',
		)
	}
	function move(index: number, direction: -1 | 1) {
		if (!selected) return
		const ids = selected.members.map(member => member.id)
		const target = index + direction
		if (target < 0 || target >= ids.length) return
		;[ids[index], ids[target]] = [ids[target], ids[index]]
		void mutate(
			selected.row.id,
			{ kind: 'reorder', paletteIds: ids },
			'Palette order saved.',
		)
	}
	return (
		<section aria-labelledby="scheme-sets-title">
			{(editing || onBack) && (
				<Button
					variant="link"
					type="button"
					className={adminStyles.backLink}
					disabled={busy || loading}
					onClick={back}
				>
					<FontAwesomeIcon
						icon={faSquareArrowLeft}
						aria-hidden="true"
					/>{' '}
					{editing ? 'Back to sets' : 'Back to palettes'}
				</Button>
			)}
			<AdminSectionHeading
				id="scheme-sets-title"
				title={
					editing ? `Palette set: ${editing.name}` : 'Palette sets'
				}
			>
				{!editing && (
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
				)}
			</AdminSectionHeading>
			<p>
				Labels organize palettes only. Core does not make them free;
				Reward does not grant a bundle. Puzzle palettes are independent
				of these sets.
			</p>
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
			{busy && !deleting && (
				<Loading
					label={
						deleting
							? 'Deleting palette set…'
							: editing?.id
								? 'Saving palette set…'
								: 'Creating palette set…'
					}
				/>
			)}
			{loading && (
				<Loading
					label={
						refreshing
							? 'Refreshing palette sets…'
							: 'Loading palette sets…'
					}
				/>
			)}
			{!editing && !loading && !catalogError && sets.length === 0 && (
				<p>No palette sets yet. Create a set to organize palettes.</p>
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
					<form
						className={adminStyles.form}
						aria-label="Palette set details"
						onSubmit={save}
					>
						<FormField label="Set name" id="scheme-set-name">
							{field => (
								<Input
									{...field}
									value={name}
									disabled={unavailable || readOnly}
									required
									onChange={event =>
										setName(event.target.value)
									}
								/>
							)}
						</FormField>
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
						{!readOnly && (
							<Button
								type="submit"
								disabled={unavailable || !name.trim() || !dirty}
							>
								Save set
							</Button>
						)}
					</form>
					{readOnly && (
						<p>Published or scheduled sets are read-only.</p>
					)}
					{selected && (
						<>
							<p>
								Assign or move palettes using the selection
								controls in the palette library. Reordering and
								removal save immediately.
							</p>
							{selected.members.length === 0 && (
								<p>This set has no palettes yet.</p>
							)}
							<AdminMemberList>
								{selected.members.map((member, index) => (
									<AdminMemberRow
										key={member.id}
										actions={
											<>
												<AdminIconButton
													icon={faArrowUp}
													label={`Move ${member.name} up`}
													disabled={
														unavailable ||
														readOnly ||
														index === 0
													}
													onClick={() =>
														move(index, -1)
													}
												/>
												<AdminIconButton
													icon={faArrowDown}
													label={`Move ${member.name} down`}
													disabled={
														unavailable ||
														readOnly ||
														index ===
															selected.members
																.length -
																1
													}
													onClick={() =>
														move(index, 1)
													}
												/>
												<AdminIconButton
													icon={faSquareMinus}
													label={`Remove ${member.name} from set`}
													disabled={
														unavailable || readOnly
													}
													className={
														adminStyles.minus
													}
													onClick={() => {
														void mutate(
															selected.row.id,
															{
																kind: 'remove',
																paletteIds: [
																	member.id,
																],
															},
															'Palette removed; its design is unchanged.',
														)
													}}
												/>
											</>
										}
									>
										<PaletteStrip
											colors={member.colors}
											variant="continuous"
										/>
										{member.name}
									</AdminMemberRow>
								))}
							</AdminMemberList>
						</>
					)}
				</>
			) : (
				<AdminGallery layout="sets">
					{sets.map(set => (
						<li
							key={set.row.id}
							className={adminStyles.setCard}
							aria-label={`Palette set ${set.row.name}`}
						>
							<div className={adminStyles.setThumbnail}>
								{set.members.length === 0 && 'Empty set'}
								{set.members.slice(0, 3).map(member => (
									<PaletteStrip
										key={member.id}
										colors={member.colors}
										variant="continuous"
									/>
								))}
							</div>
							<div className={adminStyles.setDetails}>
								<strong>{set.row.name}</strong>
								<span>
									{schemeSetLabels[set.kind]} ·{' '}
									{set.members.length} palettes
								</span>
							</div>
							<div className={adminStyles.setCardActions}>
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
							</div>
						</li>
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
							{ kind: 'delete' },
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
		</section>
	)
}
