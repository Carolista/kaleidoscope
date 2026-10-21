import {
	groupInSlot,
	rewardOf,
	type Progression,
	type Slot,
	type SlotPurpose,
	type SlotTrack,
} from './progression'

export interface PatternWarning {
	// Null for a warning about the whole progression.
	readonly shapeId: string | null
	readonly groupId: string | null
	readonly message: string
}

export const SLOT_ORDER: readonly { purpose: SlotPurpose; track: SlotTrack }[] =
	[
		{ purpose: 'core', track: 'basic' },
		{ purpose: 'core', track: 'rotation' },
		{ purpose: 'reward', track: 'basic' },
		{ purpose: 'reward', track: 'rotation' },
	]

export function slotTitle(slot: Pick<Slot, 'purpose' | 'track'>): string {
	const track = slot.track === 'basic' ? 'Basic' : 'Rotation'
	return slot.purpose === 'core' ? track : `Bonus ${track}`
}

export function slotGroupLabel(slot: Pick<Slot, 'purpose' | 'track'>): string {
	const track = slot.track === 'basic' ? 'Basic' : 'Rotation'
	return `${track} ${slot.purpose === 'core' ? 'core' : 'bonus'} group`
}

// The pattern for every shape: a basic and a rotation core group, and a basic and a rotation
// bonus group (awarded together with the rotation core group), each awarding one palette.
// Slots and rewards stay flexible, so this only warns.
export function checkRewardPattern(
	progression: Pick<Progression, 'shapeIds' | 'groups' | 'rewards'>,
	names: {
		readonly shape: (shapeId: string) => string
		readonly palette: (paletteId: string) => string
	},
): PatternWarning[] {
	const warnings: PatternWarning[] = []
	for (const shapeId of progression.shapeIds) {
		const shape = names.shape(shapeId)
		for (const { purpose, track } of SLOT_ORDER) {
			const label = slotGroupLabel({ purpose, track })
			const group = groupInSlot(progression.groups, {
				shapeId,
				purpose,
				track,
			})
			if (!group) {
				warnings.push({
					shapeId,
					groupId: null,
					message: `${shape} has no ${label.toLowerCase()}.`,
				})
				continue
			}
			const count = rewardOf(progression, group.id).paletteIds.length
			if (count === 0)
				warnings.push({
					shapeId,
					groupId: group.id,
					message: `${label} "${group.name}" awards nothing yet.`,
				})
			else if (count !== 1)
				warnings.push({
					shapeId,
					groupId: group.id,
					message: `${label} "${group.name}" should award exactly one palette (it awards ${count}).`,
				})
		}
	}

	const awardedBy = new Map<string, string[]>()
	for (const reward of progression.rewards) {
		const name =
			progression.groups.find(group => group.id === reward.groupId)
				?.name ?? 'an unknown group'
		for (const paletteId of reward.paletteIds)
			awardedBy.set(paletteId, [
				...(awardedBy.get(paletteId) ?? []),
				name,
			])
	}
	for (const [paletteId, groups] of awardedBy)
		if (groups.length > 1)
			warnings.push({
				shapeId: null,
				groupId: null,
				message: `Palette "${names.palette(paletteId)}" is awarded by more than one group: ${groups.join(', ')}.`,
			})
	return warnings
}
