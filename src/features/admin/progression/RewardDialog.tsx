import { useId, useRef, useState } from 'react'
import { AdminForm, errorMessage } from '@/features/admin/common'
import {
	rewardOf,
	type PaletteGroup,
	type Progression,
	type ProgressionGroup,
} from '@/features/admin/services'
import {
	Button,
	ConfirmDialog,
	FormField,
	Input,
	PaletteChoices,
	Select,
} from '@/ui/components'
import { useUnsavedDraft } from '@/ui/navigation'
import { shapeName } from './labels'

export interface RewardChoice {
	readonly paletteIds: readonly string[]
	readonly bonusGroupIds: readonly string[]
}

function bonusOptions(
	progression: Progression,
	group: ProgressionGroup,
	track: 'basic' | 'rotation',
) {
	return progression.groups.filter(
		candidate =>
			candidate.purpose === 'reward' &&
			candidate.shapeId === group.shapeId &&
			candidate.track === track &&
			candidate.id !== group.id,
	)
}

// Chooses what completing a group awards. Palettes come only from reward palette groups;
// the rotation core group also awards one basic and one rotation bonus group.
export default function RewardDialog({
	open,
	onAfterClose,
	group,
	progression,
	paletteGroups,
	onSave,
	onCancel,
}: {
	readonly open: boolean
	readonly onAfterClose: () => void
	readonly group: ProgressionGroup
	readonly progression: Progression
	readonly paletteGroups: readonly PaletteGroup[]
	readonly onSave: (reward: RewardChoice) => Promise<void>
	readonly onCancel: () => void
}) {
	const id = useId()
	const search = useRef<HTMLInputElement>(null)
	const current = rewardOf(progression, group.id)
	const withBonus = group.purpose === 'core' && group.track === 'rotation'
	const basicOptions = bonusOptions(progression, group, 'basic')
	const rotationOptions = bonusOptions(progression, group, 'rotation')
	const initialBonus = (options: readonly ProgressionGroup[]) =>
		options.find(option => current.bonusGroupIds.includes(option.id))?.id ??
		''
	const initial = {
		paletteId: current.paletteIds[0] ?? '',
		basicBonus: initialBonus(basicOptions),
		rotationBonus: initialBonus(rotationOptions),
	}
	const [paletteId, setPaletteId] = useState(initial.paletteId)
	const [basicBonus, setBasicBonus] = useState(initial.basicBonus)
	const [rotationBonus, setRotationBonus] = useState(initial.rotationBonus)
	const [filter, setFilter] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const working = useRef(false)
	const dirty =
		paletteId !== initial.paletteId ||
		(withBonus &&
			(basicBonus !== initial.basicBonus ||
				rotationBonus !== initial.rotationBonus))
	useUnsavedDraft({ dirty, pending: busy })

	const needle = filter.trim().toLowerCase()
	const rewardGroups = paletteGroups
		.filter(candidate => candidate.purpose === 'reward')
		.map(candidate => ({
			...candidate,
			members: candidate.members.filter(
				member => !needle || member.name.toLowerCase().includes(needle),
			),
		}))
	const available = paletteGroups
		.filter(candidate => candidate.purpose === 'reward')
		.flatMap(candidate => candidate.members)
	const selected = available.find(member => member.id === paletteId)

	async function save() {
		if (working.current) return
		working.current = true
		setBusy(true)
		setError('')
		try {
			await onSave({
				paletteIds: paletteId ? [paletteId] : [],
				bonusGroupIds: withBonus
					? [basicBonus, rotationBonus].filter(value => value !== '')
					: [...current.bonusGroupIds],
			})
		} catch (cause) {
			setError(errorMessage(cause, 'Unable to save the reward.'))
		} finally {
			working.current = false
			setBusy(false)
		}
	}

	const bonusField = (
		label: string,
		fieldId: string,
		value: string,
		options: readonly ProgressionGroup[],
		onChange: (value: string) => void,
	) => (
		<FormField label={label} id={fieldId}>
			{field => (
				<Select
					{...field}
					value={value}
					disabled={busy}
					onChange={event => onChange(event.target.value)}
				>
					<option value="">None</option>
					{options.map(option => (
						<option key={option.id} value={option.id}>
							{option.name}
						</option>
					))}
				</Select>
			)}
		</FormField>
	)

	return (
		<ConfirmDialog
			open={open}
			onAfterClose={onAfterClose}
			title={`Reward for ${group.name}`}
			closeLabel="Close reward editor"
			initialFocusRef={search}
			confirmLabel="Save reward"
			confirmForm={`${id}-form`}
			onConfirm={() => {}}
			onCancel={onCancel}
			pending={busy ? 'Saving reward…' : null}
			error={error}
		>
			<AdminForm
				id={`${id}-form`}
				aria-label="Reward details"
				onSubmit={event => {
					event.preventDefault()
					void save()
				}}
			>
				<p>
					Completing this {shapeName(group.shapeId ?? '')}{' '}
					{group.track} {group.purpose} group awards one palette
					{withBonus ? ' and two bonus groups' : ''}.
				</p>
				<FormField label="Search reward palettes" id={`${id}-search`}>
					{field => (
						<Input
							{...field}
							ref={search}
							value={filter}
							disabled={busy}
							onChange={event => setFilter(event.target.value)}
						/>
					)}
				</FormField>
				<p>
					Palette:{' '}
					<strong>{selected ? selected.name : 'None chosen'}</strong>
					{paletteId &&
						!selected &&
						' (no longer in a reward palette group)'}
				</p>
				{paletteId && (
					<Button disabled={busy} onClick={() => setPaletteId('')}>
						Clear palette
					</Button>
				)}
				{!rewardGroups.length && (
					<p>
						No reward palette groups yet. Create one under Palettes
						&gt; Groups.
					</p>
				)}
				{rewardGroups.map(
					candidate =>
						candidate.members.length > 0 && (
							<fieldset key={candidate.row.id}>
								<legend>{candidate.row.name}</legend>
								<PaletteChoices
									palettes={candidate.members}
									selectedId={paletteId}
									onSelect={setPaletteId}
									showNames
									disabled={busy}
									label={palette =>
										`Award the ${palette.name} palette`
									}
								/>
							</fieldset>
						),
				)}
				{rewardGroups.length > 0 &&
					needle &&
					rewardGroups.every(
						candidate => candidate.members.length === 0,
					) && <p>No reward palettes match this search.</p>}
				{withBonus && (
					<>
						{bonusField(
							'Basic bonus group',
							`${id}-basic`,
							basicBonus,
							basicOptions,
							setBasicBonus,
						)}
						{bonusField(
							'Rotation bonus group',
							`${id}-rotation`,
							rotationBonus,
							rotationOptions,
							setRotationBonus,
						)}
					</>
				)}
			</AdminForm>
		</ConfirmDialog>
	)
}
