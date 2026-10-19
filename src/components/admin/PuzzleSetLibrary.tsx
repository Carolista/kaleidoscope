import {
	faPenToSquare,
	faPlusLarge,
	faRotate,
	faTrashCan,
} from '@fortawesome/pro-solid-svg-icons'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import {
	deleteDraftSet,
	manageDraftSet,
	type DraftSet,
	type SetAction,
} from '@/services/puzzleSets'
import type { Database } from '@/types/database'
import { HexPuzzleBoard } from '@/ui/puzzle'
import AdminIconButton from './AdminIconButton'
import { ConfirmDialog, Loading } from '@/components/shared'
import {
	AdminFeedback,
	AdminGallery,
	AdminSectionHeading,
	AdminSetCard,
	AdminSetForm,
	AdminTag,
} from './AdminLayout'
import SetCreationDialog from './SetCreationDialog'
import useModalState from '@/hooks/useModalState'
import styles from './AdminPortal.module.css'
import { useUnsavedDraft } from '@/ui/navigation'
import SortableSetMembers from './SortableSetMembers'
import useStagedOrder from './useStagedOrder'
import { useCatalog, useCatalogInvalidation } from './useAdminCatalog'

function roleLabel(kind: string) {
	return kind === 'core' ? 'Core' : kind === 'reward' ? 'Reward' : 'Pack'
}

function errorMessage(cause: unknown) {
	return cause instanceof Error
		? cause.message
		: 'Unable to manage draft sets.'
}

// Applies a successful set action to cached sets without refetching.
function applyAction(set: DraftSet, action: SetAction): DraftSet {
	if (action.kind === 'rename')
		return { ...set, row: { ...set.row, name: action.name.trim() } }
	if (action.kind !== 'reorder' && action.kind !== 'remove') return set
	const members =
		action.kind === 'remove'
			? set.members.filter(
					member => !action.puzzleIds.includes(member.puzzleId),
				)
			: action.puzzleIds.flatMap(id =>
					set.members.filter(member => member.puzzleId === id),
				)
	return {
		...set,
		members: members.map((member, index) => ({
			...member,
			position: index + 1,
		})),
		preview: members[0]?.preview ?? null,
	}
}

export default function PuzzleSetLibrary({
	client,
}: {
	readonly client: SupabaseClient<Database>
}) {
	const catalog = useCatalog('puzzleSets', client)
	const invalidate = useCatalogInvalidation()
	const sets: readonly DraftSet[] = catalog.data ?? []
	const loading = catalog.loading
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [creating, setCreating, creationModal] = useModalState<true>()
	const [name, setName] = useState('')
	const addButton = useRef<HTMLButtonElement>(null)
	const focusAdd = useRef(false)
	const [pending, setPending] = useState<string | null>(null)
	const busy = pending !== null
	const working = useRef(false)
	const [error, setError] = useState('')
	const [deleteError, setDeleteError] = useState('')
	const [status, setStatus] = useState('')
	const [deleting, setDeleting, deleteModal] = useModalState<DraftSet>()
	const selected = sets.find(set => set.row.id === selectedId)
	const order = useStagedOrder(
		selected?.members ?? [],
		member => member.puzzleId,
	)
	const members = order.ordered
	const nameDirty = !!selected && name.trim() !== selected.row.name
	const dirty = !!selected && (name !== selected.row.name || order.dirty)
	useUnsavedDraft({ dirty, pending: busy })
	useEffect(() => {
		if (!loading && !creating && focusAdd.current) {
			addButton.current?.focus()
			focusAdd.current = false
		}
	}, [loading, creating])
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
			catalog.update(previous =>
				previous.filter(set => set.row.id !== deleting.row.id),
			)
			invalidate('puzzleDrafts')
			setDeleting(null)
		} catch (cause) {
			setDeleteError(errorMessage(cause))
		} finally {
			working.current = false
			setPending(null)
		}
	}
	async function mutate(
		id: string,
		actions: readonly SetAction[],
		success: string,
	) {
		if (working.current || !actions.length) return
		working.current = true
		setPending('Saving puzzle set…')
		setError('')
		setStatus('')
		try {
			for (const action of actions) {
				await manageDraftSet(client, id, action)
				catalog.update(previous =>
					previous.map(set =>
						set.row.id === id ? applyAction(set, action) : set,
					),
				)
				if (action.kind === 'rename') setName(action.name.trim())
				if (action.kind === 'remove') order.drop(action.puzzleIds)
				// Set names and membership appear in the puzzle catalog.
				if (action.kind === 'rename' || action.kind === 'remove')
					invalidate('puzzleDrafts')
			}
			setStatus(success)
		} catch (cause) {
			setError(errorMessage(cause))
		} finally {
			working.current = false
			setPending(null)
		}
	}
	function save() {
		if (!selected) return
		if (!name.trim()) {
			setError('Enter a set name.')
			return
		}
		void mutate(
			selected.row.id,
			[
				...(nameDirty ? [{ kind: 'rename', name } as const] : []),
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
			'Set saved.',
		)
	}
	return (
		<section aria-labelledby="draft-sets-title">
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
								setError('')
								void catalog.refresh().catch(() => {})
							}}
						/>
					</>
				)}
			</AdminSectionHeading>
			<AdminFeedback
				error={
					error || (catalog.error ? errorMessage(catalog.error) : '')
				}
				status={status}
			/>
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
						void catalog.refresh().catch(() => {})
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
						catalog.refreshing
							? 'Refreshing draft sets…'
							: 'Loading draft sets...'
					}
				/>
			) : selected ? (
				<>
					<AdminSetForm
						label="Draft set details"
						nameId="set-name"
						name={name}
						disabled={busy}
						saveDisabled={!nameDirty && !order.dirty}
						onNameChange={setName}
						onSave={save}
					>
						<AdminTag>{roleLabel(selected.row.kind)}</AdminTag>
					</AdminSetForm>
					{!selected.members.length && <p>No puzzles yet.</p>}
					<SortableSetMembers
						members={members.map(member => ({
							...member,
							id: member.puzzleId,
						}))}
						noun="puzzles"
						disabled={busy}
						preview={member => (
							<div
								className={styles.setMemberThumbnail}
								aria-hidden="true"
							>
								{member.preview ? (
									<HexPuzzleBoard
										target
										radius={member.preview.radius}
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
								'Puzzle removed from set.',
							)
						}}
					>
						{(member, index) => (
							<>
								{index + 1}. {member.name}
							</>
						)}
					</SortableSetMembers>
				</>
			) : !sets.length ? (
				!error && !catalog.error && <p>No draft sets yet.</p>
			) : (
				<AdminGallery layout="sets">
					{sets.map(set => (
						<AdminSetCard
							key={set.row.id}
							label={`Set ${set.row.name}`}
							thumbnail={
								set.preview ? (
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
								)
							}
							actions={
								<>
									<AdminIconButton
										icon={faPenToSquare}
										label={`Edit set ${set.row.name}`}
										className={styles.editAction}
										disabled={busy || !!deleting}
										onClick={() => {
											setSelectedId(set.row.id)
											setName(set.row.name)
											order.reset()
											setStatus('')
											setError('')
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
								</>
							}
						>
							<strong>{set.row.name}</strong>
							<span>{roleLabel(set.row.kind)}</span>
							<span>
								{set.members.length}{' '}
								{set.members.length === 1
									? 'puzzle'
									: 'puzzles'}
							</span>
						</AdminSetCard>
					))}
				</AdminGallery>
			)}
			{pending && !deleting && <Loading label={pending} />}
		</section>
	)
}
