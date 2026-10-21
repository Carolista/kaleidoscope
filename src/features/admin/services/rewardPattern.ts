import {
	coreGroupsOf,
	rewardOf,
	type Progression,
	type ProgressionGroup,
} from './progression'

export interface PatternWarning {
	// Null for a warning about the whole progression.
	readonly shapeId: string | null
	readonly groupId: string | null
	readonly message: string
}

// The intended pattern for every shape: the basic core group awards one palette; the
// rotation core group awards one palette plus two bonus groups (one basic, one rotation);
// each bonus group awards one palette. Rewards stay flexible, so this only warns.
export function checkRewardPattern(
	progression: Pick<Progression, 'shapeIds' | 'groups' | 'rewards'>,
	names: {
		readonly shape: (shapeId: string) => string
		readonly palette: (paletteId: string) => string
	},
): PatternWarning[] {
	const warnings: PatternWarning[] = []
	const byId = new Map(progression.groups.map(group => [group.id, group]))
	const warn = (
		shapeId: string | null,
		group: ProgressionGroup | null,
		message: string,
	) => warnings.push({ shapeId, groupId: group?.id ?? null, message })

	function oneNoBonus(
		shapeId: string,
		group: ProgressionGroup,
		label: string,
	) {
		const reward = rewardOf(progression, group.id)
		if (reward.paletteIds.length === 0 && reward.bonusGroupIds.length === 0)
			warn(shapeId, group, `${label} "${group.name}" awards nothing yet.`)
		else if (reward.paletteIds.length !== 1)
			warn(
				shapeId,
				group,
				`${label} "${group.name}" should award exactly one palette (it awards ${reward.paletteIds.length}).`,
			)
		return reward
	}

	for (const shapeId of progression.shapeIds) {
		const shape = names.shape(shapeId)
		const { basic, rotation } = coreGroupsOf(progression.groups, shapeId)
		if (!basic) warn(shapeId, null, `${shape} has no basic core group.`)
		if (!rotation)
			warn(shapeId, null, `${shape} has no rotation core group.`)

		if (basic) {
			const reward = oneNoBonus(shapeId, basic, 'Basic core group')
			if (reward.bonusGroupIds.length > 0)
				warn(
					shapeId,
					basic,
					`Basic core group "${basic.name}" should not award bonus groups.`,
				)
		}

		const awarded = new Set<string>()
		if (rotation) {
			const reward = oneNoBonus(shapeId, rotation, 'Rotation core group')
			const bonus = reward.bonusGroupIds.flatMap(id => {
				awarded.add(id)
				const group = byId.get(id)
				return group ? [group] : []
			})
			if (reward.bonusGroupIds.length !== 2)
				warn(
					shapeId,
					rotation,
					`Rotation core group "${rotation.name}" should award two bonus groups, one basic and one rotation (it awards ${reward.bonusGroupIds.length}).`,
				)
			else if (
				bonus.filter(group => group.track === 'basic').length !== 1 ||
				bonus.filter(group => group.track === 'rotation').length !== 1
			)
				warn(
					shapeId,
					rotation,
					`The bonus groups of "${rotation.name}" should be one basic and one rotation.`,
				)
			for (const group of bonus) {
				if (group.shapeId !== shapeId)
					warn(
						shapeId,
						rotation,
						`Bonus group "${group.name}" belongs to a different shape than "${rotation.name}".`,
					)
				const bonusReward = oneNoBonus(shapeId, group, 'Bonus group')
				if (bonusReward.bonusGroupIds.length > 0)
					warn(
						shapeId,
						group,
						`Bonus group "${group.name}" should not award bonus groups.`,
					)
			}
		}

		for (const group of progression.groups)
			if (
				group.purpose === 'reward' &&
				group.shapeId === shapeId &&
				!awarded.has(group.id)
			)
				warn(
					shapeId,
					group,
					`Reward group "${group.name}" is not awarded by the ${shape} rotation core group.`,
				)
	}

	const awardedBy = new Map<string, string[]>()
	for (const reward of progression.rewards) {
		const group = byId.get(reward.groupId)
		for (const paletteId of reward.paletteIds)
			awardedBy.set(paletteId, [
				...(awardedBy.get(paletteId) ?? []),
				group?.name ?? 'an unknown group',
			])
	}
	for (const [paletteId, groups] of awardedBy)
		if (groups.length > 1)
			warn(
				null,
				null,
				`Palette "${names.palette(paletteId)}" is awarded by more than one group: ${groups.join(', ')}.`,
			)
	return warnings
}
