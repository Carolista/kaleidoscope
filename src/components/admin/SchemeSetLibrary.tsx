import { useRef, useState, type SubmitEvent } from 'react'
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
import { Button, Input, Loading, Select } from '@shared'
import type { Database } from '../../types/database'
import {
	manageSchemeSet,
	schemeSetLabels,
	type SchemeSet,
	type SchemeSetAction,
	type SchemeSetKind,
} from '../../services/schemeSets'
import AdminIconButton from './AdminIconButton'
import useUnsavedDraft, { confirmDiscardDraft } from './useUnsavedDraft'
import adminStyles from './AdminPortal.module.css'
import styles from './SchemeLibrary.module.css'

export default function SchemeSetLibrary({
	client,
	sets,
	loading,
	refreshing = false,
	catalogError,
	onBack,
	onChanged,
	onDirtyChange,
}: {
	readonly client: SupabaseClient<Database>
	readonly sets: readonly SchemeSet[]
	readonly loading: boolean
	readonly refreshing?: boolean
	readonly catalogError: string
	readonly onBack: () => void
	readonly onChanged: () => void
	readonly onDirtyChange?: (dirty: boolean) => void
}) {
	const [editing, setEditing] = useState<{
		id: string | null
		name: string
		kind: SchemeSetKind
	} | null>(null)
	const [name, setName] = useState('')
	const [kind, setKind] = useState<SchemeSetKind>('undecided')
	const [error, setError] = useState('')
	const [status, setStatus] = useState('')
	const [busy, setBusy] = useState(false)
	const [deleting, setDeleting] = useState<SchemeSet | null>(null)
	const working = useRef(false)
	const pendingCreate = useRef<{ id: string; content: string } | null>(null)
	const selected = sets.find(set => set.row.id === editing?.id)
	const readOnly = !!selected?.row.published_at || !!selected?.row.release_at
	const unavailable = busy || loading || !!catalogError
	const dirty =
		!!editing &&
		!readOnly &&
		(name !== editing.name || kind !== editing.kind)
	useUnsavedDraft(dirty || busy, onDirtyChange)
	function back() {
		if (busy || (dirty && !confirmDiscardDraft())) return
		if (editing) {
			setEditing(null)
			setError('')
			setStatus('')
		} else onBack()
	}
	async function mutate(
		id: string,
		action: SchemeSetAction,
		message: string,
	) {
		if (working.current || loading || catalogError) return
		working.current = true
		setBusy(true)
		setError('')
		setStatus('')
		try {
			await manageSchemeSet(client, id, action)
			if (action.kind === 'create' || action.kind === 'update') {
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
			setError(
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
		if (!editing.id) {
			const content = JSON.stringify({ name: name.trim(), kind })
			if (pendingCreate.current?.content !== content)
				pendingCreate.current = { id: crypto.randomUUID(), content }
			void mutate(
				pendingCreate.current.id,
				{ kind: 'create', name, role: kind },
				'Palette set created.',
			)
		} else
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
			<Button
				variant="link"
				type="button"
				className={adminStyles.backLink}
				disabled={busy || loading}
				onClick={back}
			>
				<FontAwesomeIcon icon={faSquareArrowLeft} aria-hidden="true" />{' '}
				{editing ? 'Back to sets' : 'Back to palettes'}
			</Button>
			<div className={adminStyles.galleryHeading}>
				<h2 id="scheme-sets-title">
					{editing
						? editing.id
							? `Palette set: ${editing.name}`
							: 'New palette set'
						: 'Palette sets'}
				</h2>
				{!editing && (
					<AdminIconButton
						icon={faPlusLarge}
						label="New palette set"
						disabled={unavailable || !!deleting}
						onClick={() => {
							pendingCreate.current = null
							setEditing({
								id: null,
								name: '',
								kind: 'undecided',
							})
							setName('')
							setKind('undecided')
							setError('')
							setStatus('')
						}}
					/>
				)}
			</div>
			<p>
				Labels organize palettes only. Core does not make them free;
				Reward does not grant a bundle. Puzzle palettes are independent
				of these sets.
			</p>
			{error && <p role="alert">{error}</p>}
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
			{status && <p role="status">{status}</p>}
			{busy && (
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
			{editing ? (
				<>
					<form
						className={adminStyles.form}
						aria-label="Palette set details"
						onSubmit={save}
					>
						<label htmlFor="scheme-set-name">Set name</label>
						<Input
							id="scheme-set-name"
							value={name}
							disabled={unavailable || readOnly}
							required
							onChange={event => setName(event.target.value)}
						/>
						<label htmlFor="scheme-set-kind">Set label</label>
						<Select
							id="scheme-set-kind"
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
						{!readOnly && (
							<Button
								type="submit"
								disabled={
									unavailable ||
									!name.trim() ||
									(!!editing.id && !dirty)
								}
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
							<ol className={adminStyles.setMembers}>
								{selected.members.map((member, index) => (
									<li key={member.id}>
										<span>
											<span
												className={styles.swatches}
												aria-hidden="true"
											>
												{member.colors.map(
													(color, slot) => (
														<span
															key={slot}
															style={{
																backgroundColor:
																	color,
															}}
														/>
													),
												)}
											</span>
											{member.name}
										</span>
										<AdminIconButton
											icon={faArrowUp}
											label={`Move ${member.name} up`}
											disabled={
												unavailable ||
												readOnly ||
												index === 0
											}
											onClick={() => move(index, -1)}
										/>
										<AdminIconButton
											icon={faArrowDown}
											label={`Move ${member.name} down`}
											disabled={
												unavailable ||
												readOnly ||
												index ===
													selected.members.length - 1
											}
											onClick={() => move(index, 1)}
										/>
										<AdminIconButton
											icon={faSquareMinus}
											label={`Remove ${member.name} from set`}
											disabled={unavailable || readOnly}
											className={adminStyles.minus}
											onClick={() => {
												void mutate(
													selected.row.id,
													{
														kind: 'remove',
														paletteIds: [member.id],
													},
													'Palette removed; its design is unchanged.',
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
				<ul className={adminStyles.setCards}>
					{sets.map(set => (
						<li
							key={set.row.id}
							className={adminStyles.setCard}
							aria-label={`Palette set ${set.row.name}`}
						>
							<div className={adminStyles.setThumbnail}>
								{set.members.length === 0 && 'Empty set'}
								{set.members.slice(0, 3).map(member => (
									<span
										key={member.id}
										className={styles.swatches}
										aria-hidden="true"
									>
										{member.colors.map((color, index) => (
											<span
												key={index}
												style={{
													backgroundColor: color,
												}}
											/>
										))}
									</span>
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
									onClick={() => setDeleting(set)}
								/>
							</div>
						</li>
					))}
				</ul>
			)}
			{deleting && (
				<div
					role="group"
					aria-label="Confirm palette set deletion"
					className={adminStyles.bulkPanel}
				>
					<p>
						Delete "{deleting.row.name}"? Its palettes will remain
						in the library, ungrouped.
					</p>
					<Button
						type="button"
						disabled={unavailable}
						onClick={() => {
							void mutate(
								deleting.row.id,
								{ kind: 'delete' },
								'Set deleted. Its palettes remain in the library.',
							)
						}}
					>
						Confirm delete set
					</Button>{' '}
					<Button
						type="button"
						disabled={busy}
						onClick={() => setDeleting(null)}
					>
						Cancel deletion
					</Button>
				</div>
			)}
		</section>
	)
}
