import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { isPuzzleGroupTrack, type PuzzleGroupTrack } from './groupDetails'

export interface ProgressionGroup {
	readonly id: string
	readonly name: string
	readonly purpose: 'core' | 'reward'
	readonly shapeId: string | null
	readonly track: PuzzleGroupTrack | null
	readonly published: boolean
}

// What completing a group awards: palettes and bonus puzzle groups.
export interface GroupReward {
	readonly groupId: string
	readonly paletteIds: readonly string[]
	readonly bonusGroupIds: readonly string[]
}

export interface Progression {
	// Every shape, in unlock order; the first is open from the start.
	readonly shapeIds: readonly string[]
	// Core and reward puzzle groups, drafts and published.
	readonly groups: readonly ProgressionGroup[]
	readonly rewards: readonly GroupReward[]
	// The order is fixed once any core group is published.
	readonly locked: boolean
}

const PAGE = 1000

export async function loadProgression(
	client: SupabaseClient<Database>,
): Promise<Progression> {
	const shapes = await client
		.from('shape_progression')
		.select('shape_id, position')
		.order('position')
	if (shapes.error)
		throw new Error(
			`Unable to load the shape order: ${shapes.error.message}`,
		)
	if (!shapes.data) throw new Error('The shape order query returned no data.')

	const groups: ProgressionGroup[] = []
	for (let offset = 0; ; offset += PAGE) {
		const { data, error } = await client
			.from('puzzle_groups')
			.select(
				'id, name, purpose, shape_id, track, published_at, release_at',
			)
			.in('purpose', ['core', 'reward'])
			.order('id')
			.range(offset, offset + PAGE - 1)
		if (error)
			throw new Error(
				`Unable to load progression groups: ${error.message}`,
			)
		if (!data)
			throw new Error('The progression group query returned no data.')
		for (const row of data) {
			const { purpose, track } = row
			if (
				(purpose !== 'core' && purpose !== 'reward') ||
				(track !== null && !isPuzzleGroupTrack(track))
			)
				throw new Error(
					`Puzzle group "${row.name}" has an unsupported purpose or track.`,
				)
			groups.push({
				id: row.id,
				name: row.name,
				purpose,
				shapeId: row.shape_id,
				track,
				published: row.published_at !== null || row.release_at !== null,
			})
		}
		if (data.length < PAGE) break
	}

	const rewards: GroupReward[] = []
	for (let offset = 0; ; offset += PAGE) {
		const { data, error } = await client
			.from('reward_rules')
			.select(
				'id, group_id, reward_palettes(palette_id), reward_puzzle_groups(group_id)',
			)
			.order('id')
			.range(offset, offset + PAGE - 1)
		if (error) throw new Error(`Unable to load rewards: ${error.message}`)
		if (!data) throw new Error('The reward query returned no data.')
		for (const row of data)
			rewards.push({
				groupId: row.group_id,
				paletteIds: row.reward_palettes.map(item => item.palette_id),
				bonusGroupIds: row.reward_puzzle_groups.map(
					item => item.group_id,
				),
			})
		if (data.length < PAGE) break
	}

	return {
		shapeIds: shapes.data.map(row => row.shape_id),
		groups,
		rewards,
		locked: groups.some(
			group => group.purpose === 'core' && group.published,
		),
	}
}

export async function manageShapeProgression(
	client: SupabaseClient<Database>,
	shapeIds: readonly string[],
): Promise<void> {
	const { data, error } = await client.rpc('manage_shape_progression', {
		p_shape_ids: [...shapeIds],
	})
	if (error)
		throw new Error(`Unable to save the shape order: ${error.message}`)
	if (
		!data ||
		data.length !== shapeIds.length ||
		data.some((id, index) => id !== shapeIds[index])
	)
		throw new Error(
			'The shape order was not confirmed. Refresh before retrying.',
		)
}

export async function manageGroupReward(
	client: SupabaseClient<Database>,
	groupId: string,
	reward: {
		readonly paletteIds: readonly string[]
		readonly bonusGroupIds: readonly string[]
	},
): Promise<void> {
	const { data, error } = await client.rpc('manage_group_reward', {
		p_group_id: groupId,
		p_palette_ids: [...reward.paletteIds],
		p_bonus_group_ids: [...reward.bonusGroupIds],
	})
	if (error) throw new Error(`Unable to save the reward: ${error.message}`)
	if (data !== groupId)
		throw new Error(
			'The reward change was not confirmed. Refresh before retrying.',
		)
}

export function rewardOf(
	progression: Pick<Progression, 'rewards'>,
	groupId: string,
): GroupReward {
	return (
		progression.rewards.find(reward => reward.groupId === groupId) ?? {
			groupId,
			paletteIds: [],
			bonusGroupIds: [],
		}
	)
}

// The basic and rotation core groups of a shape; each may be missing.
export function coreGroupsOf(
	groups: readonly ProgressionGroup[],
	shapeId: string,
): { readonly basic?: ProgressionGroup; readonly rotation?: ProgressionGroup } {
	const core = groups.filter(
		group => group.purpose === 'core' && group.shapeId === shapeId,
	)
	return {
		basic: core.find(group => group.track === 'basic'),
		rotation: core.find(group => group.track === 'rotation'),
	}
}
