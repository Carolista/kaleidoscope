import {
	faPenToSquare,
	faPlusLarge,
	faRotate,
	faSquareArrowLeft,
	faTrashCan,
} from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import {
	deleteDraftSet,
	loadDraftSets,
	manageDraftSet,
	type DraftSet,
	type SetAction,
} from '../../services/puzzleSets'
import type { Database } from '../../types/database'
import HexPuzzleBoard from '../puzzle/HexPuzzleBoard'
import AdminIconButton from './AdminIconButton'
import { Button, ConfirmDialog, FormField, Input, Loading } from '@shared'
import { AdminFeedback, AdminGallery, AdminSectionHeading } from './AdminLayout'
import SetCreationDialog from './SetCreationDialog'
import useModalState from '../../hooks/useModalState'
import styles from './AdminPortal.module.css'
import useUnsavedDraft from './useUnsavedDraft'
import { useNavigationGuard } from './useNavigationGuard'
import PuzzleSetMembers from './PuzzleSetMembers'

function errorMessage(cause: unknown) {
	return cause instanceof Error
		? cause.message
		: 'Unable to manage draft sets.'
}

export default function PuzzleSetLibrary({
	client,
	onBack,
}: {
	readonly client: SupabaseClient<Database>
	readonly onBack?: () => void
}) {
	const [sets, setSets] = useState<readonly DraftSet[]>([])
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [creating, setCreating, creationModal] = useModalState<true>()
	const [name, setName] = useState('')
	const [memberIds, setMemberIds] = useState<readonly string[]>([])
	const addButton = useRef<HTMLButtonElement>(null)
	const focusAdd = useRef(false)
	const [loading, setLoading] = useState(true)
	const [pending, setPending] = useState<string | null>(null)
	const busy = pending !== null
	const working = useRef(false)
	const [error, setError] = useState('')
	const [deleteError, setDeleteError] = useState('')
	const [status, setStatus] = useState('')
	const [deleting, setDeleting, deleteModal] = useModalState<DraftSet>()
	const [reload, setReload] = useState(0)
	const selected = sets.find(set => set.row.id === selectedId)
	const members = [
		...memberIds.flatMap(id => {
			const member = selected?.members.find(
				value => value.puzzleId === id,
			)
			return member ? [member] : []
		}),
		...(selected?.members.filter(
			member => !memberIds.includes(member.puzzleId),
		) ?? []),
	]
	const orderDirty =
		!!selected &&
		members.some(
			(member, index) =>
				member.puzzleId !== selected.members[index]?.puzzleId,
		)
	const dirty = !!selected && (name !== selected.row.name || orderDirty)
	useUnsavedDraft({ dirty, pending: busy })
	const { requestNavigation } = useNavigationGuard()
	useEffect(() => {
		if (!loading && !creating && focusAdd.current) {
			addButton.current?.focus()
			focusAdd.current = false
		}
	}, [loading, creating])
	useEffect(() => {
		let active = true
		void loadDraftSets(client, true)
			.then(next => {
				if (!active) return
				setSets(next)
				setSelectedId(previous =>
					next.some(set => set.row.id === previous) ? previous : null,
				)
			})
			.catch((cause: unknown) => {
				if (active) {
					setError(errorMessage(cause))
				}
			})
			.finally(() => {
				if (active) setLoading(false)
			})
		return () => {
			active = false
		}
	}, [client, reload])

	async function removeSet() {
		if (!deleting || working.current) return
		working.current = true
		setPending('Deleting puzzle set…')
		setDeleteError('')
		setStatus('')
		try {
			await deleteDraftSet(client, deleting.row.id)
			setStatus(
				`Deleted "${deleting.row.name}". Its puzzles remain in the library.`,
			)
			setSets(previous =>
				previous.filter(set => set.row.id !== deleting.row.id),
			)
			setDeleting(null)
			setLoading(true)
			setReload(value => value + 1)
		} catch (cause) {
			setDeleteError(errorMessage(cause))
		} finally {
			working.current = false
			setPending(null)
		}
	}
	async function mutate(id: string, action: SetAction, success: string) {
		if (working.current) return
		working.current = true
		setPending(
			action.kind === 'create'
				? 'Creating puzzle set…'
				: 'Saving puzzle set…',
		)
		setError('')
		setStatus('')
		try {
			await manageDraftSet(client, id, action)
			setStatus(success)
			if (action.kind === 'rename') {
				setName(action.name.trim())
			}
			if (action.kind === 'reorder' || action.kind === 'remove') {
				setSets(previous =>
					previous.map(set => {
						if (set.row.id !== id) return set
						const nextMembers =
							action.kind === 'remove'
								? set.members.filter(
										member =>
											!action.puzzleIds.includes(
												member.puzzleId,
											),
									)
								: action.puzzleIds.flatMap(puzzleId => {
										const member = set.members.find(
											value =>
												value.puzzleId === puzzleId,
										)
										return member ? [member] : []
									})
						return {
							...set,
							members: nextMembers.map((member, index) => ({
								...member,
								position: index + 1,
							})),
							preview: nextMembers[0]?.preview ?? null,
						}
					}),
				)
				if (action.kind === 'remove') {
					setMemberIds(previous =>
						previous.filter(id => !action.puzzleIds.includes(id)),
					)
				}
			}
			// Keep the renamed baseline current while the catalog reloads.
			if (action.kind === 'rename') {
				setSets(previous =>
					previous.map(set =>
						set.row.id === id
							? {
									...set,
									row: {
										...set.row,
										name: action.name.trim(),
									},
								}
							: set,
					),
				)
			}
			setLoading(true)
			setReload(value => value + 1)
		} catch (cause) {
			setError(errorMessage(cause))
		} finally {
			working.current = false
			setPending(null)
		}
	}
	function back() {
		requestNavigation(() => {
			if (selectedId) {
				setSelectedId(null)
				setName('')
				setMemberIds([])
				setError('')
				setStatus('')
			} else onBack?.()
		})
	}
	function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!name.trim()) {
			setError('Enter a set name.')
			return
		}
		if (selected) {
			void mutate(
				selected.row.id,
				{ kind: 'rename', name },
				'Set name saved.',
			)
		}
	}
	return (
		<section aria-labelledby="draft-sets-title">
			{(selectedId || onBack) && (
				<Button
					variant="link"
					type="button"
					className={styles.backLink}
					disabled={busy || loading}
					onClick={back}
				>
					<FontAwesomeIcon
						icon={faSquareArrowLeft}
						aria-hidden="true"
					/>{' '}
					{selectedId ? 'Back to sets' : 'Back to library'}
				</Button>
			)}
			<AdminSectionHeading
				id="draft-sets-title"
				title={selected ? `Set: ${selected.row.name}` : 'Draft sets'}
			>
				{!selected && (
					<>
						<AdminIconButton
							icon={faPlusLarge}
							label="New set"
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
							label="Refresh sets"
							disabled={busy || loading || !!deleting}
							onClick={() => {
								setLoading(true)
								setError('')
								setReload(value => value + 1)
							}}
						/>
					</>
				)}
			</AdminSectionHeading>
			<AdminFeedback error={error} status={status} />
			{pending && !deleting && <Loading label={pending} />}
			{creating && (
				<SetCreationDialog
					{...creationModal}
					title="New set"
					formLabel="Create draft set"
					kindLabel="Set role"
					kinds={{
						core: 'Core progression',
						reward: 'Reward',
						paid: 'Paid',
					}}
					initialKind="core"
					confirmLabel="Create set"
					pendingLabel="Creating puzzle set…"
					onCancel={() => setCreating(null)}
					onCreate={async (id, name, kind) => {
						await manageDraftSet(client, id, {
							kind: 'create',
							name,
							role: kind,
						})
						focusAdd.current = true
						setCreating(null)
						setStatus('Draft set created.')
						setLoading(true)
						setReload(value => value + 1)
					}}
				/>
			)}
			{deleting && (
				<ConfirmDialog
					{...deleteModal}
					title="Confirm set deletion"
					closeLabel="Close set deletion"
					destructive
					message={`Delete "${deleting.row.name}"? Its ${deleting.members.length} puzzles will be unassigned, not deleted.`}
					confirmLabel="Confirm delete set"
					cancelLabel="Keep set"
					pending={pending}
					error={deleteError}
					onConfirm={() => {
						void removeSet()
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
						reload > 0
							? 'Refreshing draft sets…'
							: 'Loading draft sets...'
					}
				/>
			) : selected ? (
				<>
					<form
						className={styles.form}
						onSubmit={save}
						aria-label="Rename draft set"
					>
						<FormField id="set-name" label="Set name">
							{field => (
								<Input
									{...field}
									required
									value={name}
									disabled={busy}
									onChange={event =>
										setName(event.target.value)
									}
								/>
							)}
						</FormField>
						<p>
							Role: {selected?.row.kind} · Hexagon ·{' '}
							{selected?.members.length} puzzles
						</p>
						<Button type="submit" disabled={busy || !name.trim()}>
							Save name
						</Button>
					</form>
					{selected && (
						<>
							<p>
								Add unassigned Set/pack drafts using “Assign to
								set” in the puzzle gallery. No puzzle count is
								required.
							</p>
							<p>
								Ordering saves only when you choose Save order.
								Removal saves immediately without deleting the
								puzzle. Player selection rules and qualifying
								routes are configured separately.
							</p>
							{!selected.members.length && (
								<p>This set has no puzzles yet.</p>
							)}
							<PuzzleSetMembers
								members={members}
								disabled={busy}
								onReorder={setMemberIds}
								onRemove={puzzleId => {
									void mutate(
										selected.row.id,
										{
											kind: 'remove',
											puzzleIds: [puzzleId],
										},
										'Puzzle removed from set.',
									)
								}}
							/>
							<Button
								disabled={busy || !orderDirty}
								onClick={() => {
									void mutate(
										selected.row.id,
										{
											kind: 'reorder',
											puzzleIds: members.map(
												member => member.puzzleId,
											),
										},
										'Puzzle order saved.',
									)
								}}
							>
								Save order
							</Button>
						</>
					)}
				</>
			) : !sets.length ? (
				!error && <p>No draft sets yet.</p>
			) : (
				<AdminGallery layout="sets">
					{sets.map(set => (
						<li
							key={set.row.id}
							className={styles.setCard}
							aria-label={`Set ${set.row.name}`}
						>
							<div className={styles.setDetails}>
								<strong>{set.row.name}</strong>
								<span>
									{set.row.kind === 'core'
										? 'Core'
										: set.row.kind === 'reward'
											? 'Reward'
											: 'Pack'}
								</span>
								<span>
									{set.members.length}{' '}
									{set.members.length === 1
										? 'puzzle'
										: 'puzzles'}
								</span>
							</div>
							<div className={styles.setCardActions}>
								<AdminIconButton
									icon={faPenToSquare}
									label={`Edit set ${set.row.name}`}
									className={styles.editAction}
									disabled={busy || !!deleting}
									onClick={() => {
										setSelectedId(set.row.id)
										setName(set.row.name)
										setMemberIds(
											set.members.map(
												member => member.puzzleId,
											),
										)
										setStatus('')
									}}
								/>
								<AdminIconButton
									icon={faTrashCan}
									label={`Delete set ${set.row.name}`}
									className={styles.deleteAction}
									disabled={busy || !!deleting}
									onClick={() => {
										setDeleting(set)
										setDeleteError('')
										setStatus('')
									}}
								/>
							</div>
							<div
								className={styles.setThumbnail}
								aria-hidden="true"
							>
								{set.preview ? (
									<HexPuzzleBoard
										target
										radius={set.preview.radius}
										colors={set.preview.target}
									/>
								) : (
									<span>
										{set.members.length
											? 'Preview unavailable'
											: 'Empty set'}
									</span>
								)}
							</div>
						</li>
					))}
				</AdminGallery>
			)}
		</section>
	)
}
