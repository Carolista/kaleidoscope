import {
	faArrowDown,
	faArrowUp,
	faPenToSquare,
	faPlusLarge,
	faRotate,
	faSquareArrowLeft,
	faSquareMinus,
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
import { Button, ConfirmDialog, Input, Loading } from '@shared'
import SetCreationDialog from './SetCreationDialog'
import useModalState from '../../hooks/useModalState'
import styles from './AdminPortal.module.css'
import useUnsavedDraft from './useUnsavedDraft'
import { useNavigationGuard } from './useNavigationGuard'

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
	readonly onBack: () => void
}) {
	const [sets, setSets] = useState<readonly DraftSet[]>([])
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [creating, setCreating, creationModal] = useModalState<true>()
	const [name, setName] = useState('')
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
	const dirty = !!selected && name !== selected.row.name
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
				setError('')
				setStatus('')
			} else onBack()
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
	function move(index: number, direction: -1 | 1) {
		if (!selected) return
		const ids = selected.members.map(member => member.puzzleId)
		const destination = index + direction
		if (destination < 0 || destination >= ids.length) return
		;[ids[index], ids[destination]] = [ids[destination], ids[index]]
		void mutate(
			selected.row.id,
			{ kind: 'reorder', puzzleIds: ids },
			'Puzzle order saved.',
		)
	}

	return (
		<section aria-labelledby="draft-sets-title">
			<Button
				variant="link"
				type="button"
				className={styles.backLink}
				disabled={busy || loading}
				onClick={back}
			>
				<FontAwesomeIcon icon={faSquareArrowLeft} aria-hidden="true" />{' '}
				{selectedId ? 'Back to sets' : 'Back to library'}
			</Button>
			<div className={styles.galleryHeading}>
				<h2 id="draft-sets-title">
					{selected ? `Set: ${selected.row.name}` : 'Draft sets'}
				</h2>
				{!selected && (
					<div className={styles.galleryControls}>
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
					</div>
				)}
			</div>
			{error && <p role="alert">{error}</p>}
			{status && <p role="status">{status}</p>}
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
						<div className={styles.metadataField}>
							<label htmlFor="set-name">Set name</label>
							<Input
								id="set-name"
								required
								value={name}
								disabled={busy}
								onChange={event => setName(event.target.value)}
							/>
						</div>
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
								Ordering and removal save immediately. Removing
								a puzzle does not delete it. Player selection
								rules and qualifying routes are configured
								separately.
							</p>
							{!selected.members.length && (
								<p>This set has no puzzles yet.</p>
							)}
							<ol className={styles.setMembers}>
								{selected.members.map((member, index) => (
									<li key={member.puzzleId}>
										<div
											className={
												styles.setMemberThumbnail
											}
											aria-hidden="true"
										>
											{member.preview ? (
												<HexPuzzleBoard
													target
													radius={
														member.preview.radius
													}
													colors={
														member.preview.target
													}
												/>
											) : (
												<span>Preview unavailable</span>
											)}
										</div>
										<span>
											{index + 1}. {member.name}
										</span>
										<AdminIconButton
											icon={faArrowUp}
											label={`Move ${member.name} up`}
											disabled={busy || index === 0}
											onClick={() => move(index, -1)}
										/>
										<AdminIconButton
											icon={faArrowDown}
											label={`Move ${member.name} down`}
											disabled={
												busy ||
												index ===
													selected.members.length - 1
											}
											onClick={() => move(index, 1)}
										/>
										<AdminIconButton
											icon={faSquareMinus}
											className={styles.minus}
											label={`Remove ${member.name} from set`}
											disabled={busy}
											onClick={() => {
												void mutate(
													selected.row.id,
													{
														kind: 'remove',
														puzzleIds: [
															member.puzzleId,
														],
													},
													'Puzzle removed from set.',
												)
											}}
										/>
									</li>
								))}
							</ol>
						</>
					)}
				</>
			) : (
				<ul className={styles.setCards}>
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
					{!sets.length && !error && <li>No draft sets yet.</li>}
				</ul>
			)}
		</section>
	)
}
