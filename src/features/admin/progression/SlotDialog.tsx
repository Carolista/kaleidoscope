import { toGrayscale } from '@/domain/palettes'
import { faRotateLeft } from '@fortawesome/pro-solid-svg-icons'
import {
	AdminForm,
	AdminIconButton,
	errorMessage,
} from '@/features/admin/common'
import {
	candidateFits,
	puzzleGroupPurposeLabels,
	rewardOf,
	slotGroupLabel,
	type PaletteGroup,
	type Progression,
	type ProgressionGroup,
	type Slot,
} from '@/features/admin/services'
import {
	ConfirmDialog,
	FormField,
	PaletteChoices,
	Select,
} from '@/ui/components'
import { useUnsavedDraft } from '@/ui/navigation'
import { useId, useRef, useState } from 'react'
import { shapeName } from './labels'
import styles from './SlotDialog.module.css'

export interface SlotChoice {
	// Null empties the slot.
	readonly groupId: string | null
	readonly paletteIds: readonly string[]
}

// Fills one slot with a puzzle group and picks the reward palette it awards. Palettes come
// only from reward palette groups; palettes another group already awards are greyed out.
export default function SlotDialog({
	open,
	onAfterClose,
	slot,
	current,
	progression,
	paletteGroups,
	onSave,
	onCancel,
}: {
	readonly open: boolean
	readonly onAfterClose: () => void
	readonly slot: Slot
	readonly current: ProgressionGroup | undefined
	readonly progression: Progression
	readonly paletteGroups: readonly PaletteGroup[]
	readonly onSave: (choice: SlotChoice) => Promise<void>
	readonly onCancel: () => void
}) {
	const id = useId()
	const groupSelect = useRef<HTMLSelectElement>(null)
	const currentPalette = current
		? (rewardOf(progression, current.id).paletteIds[0] ?? '')
		: ''
	const initial = { groupId: current?.id ?? '', paletteId: currentPalette }
	const [groupId, setGroupId] = useState(initial.groupId)
	const [paletteId, setPaletteId] = useState(initial.paletteId)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const working = useRef(false)
	useUnsavedDraft({
		dirty: groupId !== initial.groupId || paletteId !== initial.paletteId,
		pending: busy,
	})

	const candidates = progression.candidates
		.filter(candidate => candidateFits(candidate, slot))
		.sort((a, b) => a.name.localeCompare(b.name))
	const chosenCandidate = candidates.find(
		candidate => candidate.id === groupId,
	)
	const replaced = !!current && groupId !== current.id
	const label = slotGroupLabel(slot)
	const shape = shapeName(slot.shapeId)

	// Palettes that groups other than this slot's own group already award.
	const takenBy = new Map<string, string>()
	for (const reward of progression.rewards) {
		if (reward.groupId === current?.id) continue
		const name =
			progression.groups.find(group => group.id === reward.groupId)
				?.name ?? 'another group'
		for (const taken of reward.paletteIds) takenBy.set(taken, name)
	}
	const rewardGroups = paletteGroups.filter(
		candidate =>
			candidate.purpose === 'reward' && candidate.members.length > 0,
	)
	const selected = rewardGroups
		.flatMap(candidate => candidate.members)
		.find(member => member.id === paletteId)

	async function save() {
		if (working.current) return
		working.current = true
		setBusy(true)
		setError('')
		try {
			await onSave({
				groupId: groupId || null,
				paletteIds: groupId && paletteId ? [paletteId] : [],
			})
		} catch (cause) {
			setError(errorMessage(cause, 'Unable to save the slot.'))
		} finally {
			working.current = false
			setBusy(false)
		}
	}

	return (
		<ConfirmDialog
			open={open}
			onAfterClose={onAfterClose}
			title={`${shape}: ${label}`}
			closeLabel="Close slot editor"
			initialFocusRef={groupSelect}
			confirmLabel="Save"
			confirmForm={`${id}-form`}
			onConfirm={() => {}}
			onCancel={onCancel}
			pending={busy ? 'Saving…' : null}
			error={error}
		>
			<AdminForm
				id={`${id}-form`}
				aria-label="Slot details"
				onSubmit={event => {
					event.preventDefault()
					void save()
				}}
			>
				<FormField label="Puzzle group" id={`${id}-group`}>
					{field => (
						<Select
							{...field}
							ref={groupSelect}
							value={groupId}
							disabled={busy}
							onChange={event => {
								const next = event.target.value
								setGroupId(next)
								setPaletteId(
									next === initial.groupId
										? initial.paletteId
										: '',
								)
							}}
						>
							<option value="">Not assigned</option>
							{current && (
								<option value={current.id}>
									{current.name}
								</option>
							)}
							{candidates.map(candidate => (
								<option key={candidate.id} value={candidate.id}>
									{candidate.name} (
									{
										puzzleGroupPurposeLabels[
											candidate.purpose
										]
									}
									, {candidate.memberCount}{' '}
									{candidate.memberCount === 1
										? 'puzzle'
										: 'puzzles'}
									)
								</option>
							))}
						</Select>
					)}
				</FormField>
				{!candidates.length && !current && (
					<p>
						No unassigned puzzle group fits here. Create one under
						Puzzles &gt; Groups, or remove puzzles that do not match
						this shape and track.
					</p>
				)}
				{chosenCandidate && (
					<p>
						"{chosenCandidate.name}" will become the {shape}{' '}
						{label.toLowerCase()}.
					</p>
				)}
				{replaced && current && (
					<p>
						"{current.name}" will become Undecided and lose its
						reward.
					</p>
				)}
				{groupId ? (
					<>
						<p className={styles.current}>
							Current reward palette:{' '}
							<strong>
								{selected ? selected.name : 'No selection'}
							</strong>
							{paletteId && (
								<AdminIconButton
									icon={faRotateLeft}
									label="Clear reward palette"
									disabled={busy}
									onClick={() => setPaletteId('')}
								/>
							)}
						</p>
						{!rewardGroups.length && (
							<p>
								No reward palette groups yet. Create one under
								Palettes &gt; Groups.
							</p>
						)}
						{rewardGroups.map(candidate => (
							<fieldset
								className={styles.palettes}
								key={candidate.row.id}
								disabled={busy}
							>
								<legend>{candidate.row.name}</legend>
								<PaletteChoices
									palettes={candidate.members.map(member =>
										takenBy.has(member.id)
											? {
													...member,
													colors: member.colors.map(
														toGrayscale,
													),
												}
											: member,
									)}
									selectedId={paletteId}
									onSelect={setPaletteId}
									isDisabled={palette =>
										takenBy.has(palette.id)
									}
									showNames
									disabled={busy}
									label={palette =>
										takenBy.has(palette.id)
											? `Already awarded by ${takenBy.get(palette.id)}`
											: `Award the ${palette.name} palette`
									}
								/>
							</fieldset>
						))}
					</>
				) : (
					!current && (
						<p>Choose a puzzle group to pick its reward palette.</p>
					)
				)}
			</AdminForm>
		</ConfirmDialog>
	)
}
