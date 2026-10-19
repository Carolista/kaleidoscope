import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { readHexPuzzleTarget } from '@/domain/puzzles'

export interface SchemeUsage {
	readonly puzzles: readonly {
		readonly id: string
		readonly name: string
		readonly context: string
		readonly preview: ReturnType<typeof readHexPuzzleTarget> | null
	}[]
	readonly rewards: readonly string[]
	readonly packs: readonly string[]
	readonly preparedPacks?: number
	readonly starters: number
	readonly grants: number
	readonly corrections: number
}

export function schemeIsUsed(usage: SchemeUsage): boolean {
	return !!(
		usage.puzzles.length ||
		usage.rewards.length ||
		(usage.preparedPacks ?? usage.packs.length) ||
		usage.starters ||
		usage.grants ||
		usage.corrections
	)
}

export async function loadSchemeUsage(
	client: SupabaseClient<Database>,
	id: string,
): Promise<SchemeUsage> {
	const puzzles: SchemeUsage['puzzles'][number][] = []
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await client
			.from('puzzles')
			.select(
				'id, name, usage, shape_id, definition, collection_puzzles(puzzle_collections(name))',
			)
			.eq('palette_id', id)
			.order('id')
			.range(offset, offset + 999)
		if (error)
			throw new Error(`Unable to load palette puzzles: ${error.message}`)
		if (!data) throw new Error('The palette puzzle query returned no data.')
		for (const row of data) {
			const sets = row.collection_puzzles.map(member => {
				if (!member.puzzle_collections)
					throw new Error(
						'A linked puzzle set could not be resolved. Refresh the catalog.',
					)
				return member.puzzle_collections.name
			})
			puzzles.push({
				id: row.id,
				name: row.name,
				context:
					row.usage === 'daily'
						? 'Daily'
						: sets.join(', ') || 'Unassigned Set/pack',
				preview:
					row.shape_id === 'hexagon'
						? readHexPuzzleTarget(row.definition)
						: null,
			})
		}
		if (data.length < 1000) break
	}
	const rewards: string[] = []
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await client
			.from('reward_palettes')
			.select(
				'reward_rule_id, reward_rules(puzzle_collections!reward_rules_collection_id_fkey(name), completion_routes!reward_rules_route_id_collection_id_fkey(name))',
			)
			.eq('palette_id', id)
			.order('reward_rule_id')
			.range(offset, offset + 999)
		if (error)
			throw new Error(`Unable to load palette rewards: ${error.message}`)
		if (!data) throw new Error('The palette reward query returned no data.')
		for (const row of data) {
			const rule = row.reward_rules
			if (!rule?.puzzle_collections)
				throw new Error(
					'A palette reward set could not be resolved. Refresh the catalog.',
				)
			rewards.push(
				`${rule.puzzle_collections.name}${rule.completion_routes ? ` / ${rule.completion_routes.name}` : ' / Any qualifying route'}`,
			)
		}
		if (data.length < 1000) break
	}
	const packs: string[] = []
	let preparedPacks = 0
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await client
			.from('palette_pack_palettes')
			.select('pack_id, palette_packs(name, published_at, release_at)')
			.eq('palette_id', id)
			.order('pack_id')
			.range(offset, offset + 999)
		if (error)
			throw new Error(`Unable to load palette packs: ${error.message}`)
		if (!data) throw new Error('The palette pack query returned no data.')
		for (const row of data) {
			if (!row.palette_packs)
				throw new Error(
					'A palette pack could not be resolved. Refresh the catalog.',
				)
			packs.push(row.palette_packs.name)
			if (row.palette_packs.published_at || row.palette_packs.release_at)
				preparedPacks++
		}
		if (data.length < 1000) break
	}
	async function count(
		table: 'starter_palettes' | 'palette_grants' | 'palette_corrections',
	) {
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
	const [starters, grants, corrections] = await Promise.all([
		count('starter_palettes'),
		count('palette_grants'),
		count('palette_corrections'),
	])
	return {
		puzzles,
		rewards,
		packs,
		preparedPacks,
		starters,
		grants,
		corrections,
	}
}
