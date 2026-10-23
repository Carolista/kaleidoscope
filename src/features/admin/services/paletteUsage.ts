import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { isPuzzleShapeId, readPuzzleTarget } from '@/domain/puzzles'
import {
	isPaletteGroupPurpose,
	isPuzzleGroupPurpose,
	paletteGroupPurposeLabels,
	puzzleGroupPurposeLabels,
} from './groupDetails'

// Label parts are shown joined by a separator dot.
export interface PaletteUsage {
	readonly puzzles: readonly {
		readonly id: string
		readonly name: string
		readonly context: readonly string[]
		readonly preview: ReturnType<typeof readPuzzleTarget> | null
	}[]
	readonly rewards: readonly string[]
	readonly groups: readonly (readonly string[])[]
	readonly preparedGroups?: number
	readonly grants: number
	readonly corrections: number
}

export function paletteIsUsed(usage: PaletteUsage): boolean {
	return !!(
		usage.puzzles.length ||
		usage.rewards.length ||
		(usage.preparedGroups ?? usage.groups.length) ||
		usage.grants ||
		usage.corrections
	)
}

export async function loadPaletteUsage(
	client: SupabaseClient<Database>,
	id: string,
): Promise<PaletteUsage> {
	const puzzles: PaletteUsage['puzzles'][number][] = []
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await client
			.from('puzzles')
			.select(
				'id, name, shape_id, definition, puzzle_group_members(puzzle_groups(name, purpose))',
			)
			.eq('palette_id', id)
			.order('id')
			.range(offset, offset + 999)
		if (error)
			throw new Error(`Unable to load palette puzzles: ${error.message}`)
		if (!data) throw new Error('The palette puzzle query returned no data.')
		for (const row of data) {
			const group = row.puzzle_group_members
			if (group && !group.puzzle_groups)
				throw new Error(
					'A linked puzzle group could not be resolved. Refresh the catalog.',
				)
			const purpose = group?.puzzle_groups?.purpose
			puzzles.push({
				id: row.id,
				name: row.name,
				context:
					group?.puzzle_groups && purpose
						? [
								isPuzzleGroupPurpose(purpose)
									? puzzleGroupPurposeLabels[purpose]
									: purpose,
								group.puzzle_groups.name,
							]
						: ['Unassigned'],
				preview: isPuzzleShapeId(row.shape_id)
					? readPuzzleTarget(row.shape_id, row.definition)
					: null,
			})
		}
		if (data.length < 1000) break
	}
	const rewards: string[] = []
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await client
			.from('reward_palettes')
			// Named because bonus links give reward_rules a second path to puzzle_groups.
			.select(
				'reward_rule_id, reward_rules(puzzle_groups!reward_rules_group_id_fkey(name))',
			)
			.eq('palette_id', id)
			.order('reward_rule_id')
			.range(offset, offset + 999)
		if (error)
			throw new Error(`Unable to load palette rewards: ${error.message}`)
		if (!data) throw new Error('The palette reward query returned no data.')
		for (const row of data) {
			const rule = row.reward_rules
			if (!rule?.puzzle_groups)
				throw new Error(
					'A palette reward group could not be resolved. Refresh the catalog.',
				)
			rewards.push(rule.puzzle_groups.name)
		}
		if (data.length < 1000) break
	}
	const groups: string[][] = []
	let preparedGroups = 0
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await client
			.from('palette_group_members')
			.select(
				'group_id, palette_groups(name, purpose, published_at, release_at)',
			)
			.eq('palette_id', id)
			.order('group_id')
			.range(offset, offset + 999)
		if (error)
			throw new Error(`Unable to load palette groups: ${error.message}`)
		if (!data) throw new Error('The palette group query returned no data.')
		for (const row of data) {
			const group = row.palette_groups
			if (!group)
				throw new Error(
					'A palette group could not be resolved. Refresh the catalog.',
				)
			groups.push([
				group.name,
				isPaletteGroupPurpose(group.purpose)
					? paletteGroupPurposeLabels[group.purpose]
					: group.purpose,
			])
			if (group.published_at || group.release_at) preparedGroups++
		}
		if (data.length < 1000) break
	}
	async function count(table: 'palette_grants' | 'palette_corrections') {
		const { count, error } = await client
			.from(table)
			.select('palette_id', { count: 'exact', head: true })
			.eq('palette_id', id)
		if (error)
			throw new Error(`Unable to check palette usage: ${error.message}`)
		if (typeof count !== 'number')
			throw new Error('The palette usage count was not returned.')
		return count
	}
	const [grants, corrections] = await Promise.all([
		count('palette_grants'),
		count('palette_corrections'),
	])
	return {
		puzzles,
		rewards,
		groups,
		preparedGroups,
		grants,
		corrections,
	}
}
