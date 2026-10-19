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
	type SetKind,
} from '../../services/puzzleSets'
import type { Database } from '../../types/database'
import HexPuzzleBoard from '../puzzle/HexPuzzleBoard'
import AdminIconButton from './AdminIconButton'
import { Button, Input, Loading, Select } from '@shared'
import styles from './AdminPortal.module.css'
import useUnsavedDraft, { confirmDiscardDraft } from './useUnsavedDraft'

function errorMessage(cause: unknown) {
	return cause instanceof Error
		? cause.message
		: 'Unable to manage draft sets.'
}

export default function PuzzleSetLibrary({
	client,
	onBack,
	onDirtyChange,
}: {
	readonly client: SupabaseClient<Database>
	readonly onBack: () => void
	readonly onDirtyChange?: (dirty: boolean) => void
}) {
	const [sets, setSets] = useState<readonly DraftSet[]>([])
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [creating, setCreating] = useState(false)
	const [name, setName] = useState('')
	const [kind, setKind] = useState<SetKind>('core')
	const [loading, setLoading] = useState(true)
	const [pending, setPending] = useState<string | null>(null)
	const busy = pending !== null
	const working = useRef(false)
	const createId = useRef<string | null>(null)
	const [error, setError] = useState('')
	const [status, setStatus] = useState('')
	const [deleting, setDeleting] = useState<DraftSet | null>(null)
	const [reload, setReload] = useState(0)
	const selected = sets.find(set => set.row.id === selectedId)
	const dirty = creating
		? name.length > 0 || kind !== 'core'
		: !!selected && name !== selected.row.name
	useUnsavedDraft(dirty || busy, onDirtyChange)
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
		setError('')
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
			setError(errorMessage(cause))
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
			if (action.kind === 'create') {
				setCreating(false)
				setSelectedId(id)
				setName(action.name.trim())
				createId.current = null
			} else if (action.kind === 'rename') {
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
		if (dirty && !confirmDiscardDraft()) return
		if (creating || selectedId) {
			setCreating(false)
			setSelectedId(null)
			setName('')
			setError('')
			setStatus('')
		} else onBack()
	}
	function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!name.trim()) {
			setError('Enter a set name.')
			return
		}
		if (creating) {
			createId.current ??= crypto.randomUUID()
			void mutate(
				createId.current,
				{ kind: 'create', name, role: kind },
				'Draft set created.',
			)
		} else if (selected) {
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
				{creating || selectedId ? 'Back to sets' : 'Back to library'}
			</Button>
			<div className={styles.galleryHeading}>
				<h2 id="draft-sets-title">
					{creating
						? 'New set'
						: selected
							? `Set: ${selected.row.name}`
							: 'Draft sets'}
				</h2>
				{!creating && !selected && (
					<div className={styles.galleryControls}>
						<AdminIconButton
							icon={faPlusLarge}
							label="New set"
							disabled={busy || loading || !!deleting}
							onClick={() => {
								setCreating(true)
								setName('')
								setKind('core')
								createId.current = null
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
			{pending && <Loading label={pending} />}
			{deleting && (
				<div
					role="group"
					aria-label="Confirm set deletion"
					className={styles.bulkPanel}
				>
					<p>
						Delete "{deleting.row.name}"? Its{' '}
						{deleting.members.length} puzzles will be unassigned,
						not deleted.
					</p>
					<Button
						type="button"
						disabled={busy}
						onClick={() => {
							void removeSet()
						}}
					>
						Confirm delete set
					</Button>
					<Button
						type="button"
						disabled={busy}
						onClick={() => setDeleting(null)}
					>
						Keep set
					</Button>
				</div>
			)}
			{loading ? (
				<Loading
					label={
						reload > 0
							? 'Refreshing draft sets…'
							: 'Loading draft sets...'
					}
				/>
			) : creating || selected ? (
				<>
					<form
						className={styles.form}
						onSubmit={save}
						aria-label={
							creating ? 'Create draft set' : 'Rename draft set'
						}
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
						{creating ? (
							<div className={styles.metadataField}>
								<label htmlFor="set-kind">Set role</label>
								<Select
									id="set-kind"
									value={kind}
									disabled={busy}
									onChange={event => {
										const value = event.target.value
										if (
											value === 'core' ||
											value === 'reward' ||
											value === 'paid'
										)
											setKind(value)
									}}
								>
									<option value="core">
										Core progression
									</option>
									<option value="reward">Reward</option>
									<option value="paid">Paid</option>
								</Select>
							</div>
						) : (
							<p>
								Role: {selected?.row.kind} · Hexagon ·{' '}
								{selected?.members.length} puzzles
							</p>
						)}
						<Button type="submit" disabled={busy || !name.trim()}>
							{creating ? 'Create set' : 'Save name'}
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
										setError('')
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
