import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/supabase'
import {
	loadPaletteUsage,
	paletteIsUsed,
	type PaletteUsage,
} from './paletteUsage'

function clientFrom(value: object) {
	return value as SupabaseClient<Database>
}

const definition = {
	version: 2,
	geometry: { radius: 4 },
	target: { '0,0': 0, '1,0': 4 },
}
const puzzle = {
	id: 'puzzle',
	name: 'Saved art',
	shape_id: 'hexagon',
	usage: 'collection',
	definition,
	collection_puzzles: [{ puzzle_collections: { name: 'First set' } }],
}
function setup() {
	const pages = {
		puzzles: vi.fn().mockResolvedValue({ data: [puzzle], error: null }),
		reward_palettes: vi.fn().mockResolvedValue({
			data: [
				{
					reward_rule_id: 'rule',
					reward_rules: {
						puzzle_collections: { name: 'First set' },
						completion_routes: { name: 'Hard route' },
					},
				},
			],
			error: null,
		}),
		palette_pack_palettes: vi.fn().mockResolvedValue({
			data: [{ pack_id: 'pack', palette_packs: { name: 'Autumn pack' } }],
			error: null,
		}),
	}
	const counts = {
		starter_palettes: vi.fn().mockResolvedValue({ count: 1, error: null }),
		palette_grants: vi.fn().mockResolvedValue({ count: 2, error: null }),
		palette_corrections: vi
			.fn()
			.mockResolvedValue({ count: 3, error: null }),
	}
	const selects = vi.fn()
	const filters = vi.fn()
	const from = vi.fn((table: string) => ({
		select: (
			columns: string,
			options?: { head: boolean; count: string },
		) => {
			selects(table, columns, options)
			if (table in counts) {
				return {
					eq: (...args: unknown[]) => {
						filters(table, ...args)
						return counts[table as keyof typeof counts]()
					},
				}
			}
			const query = {
				eq: (...args: unknown[]) => {
					filters(table, ...args)
					return query
				},
				order: vi.fn().mockReturnThis(),
				range: pages[table as keyof typeof pages],
			}
			return query
		},
	}))
	const client = clientFrom({ from })
	return { client, pages, counts, selects, filters }
}

describe('palette usage', () => {
	it('reads stored target slots and references without private solutions or account identities', async () => {
		const { client, selects, filters } = setup()
		const usage = await loadPaletteUsage(client, 'cabo')
		expect(usage).toEqual({
			puzzles: [
				{
					id: 'puzzle',
					name: 'Saved art',
					context: 'First set',
					preview: { radius: 4, target: definition.target },
				},
			],
			rewards: ['First set / Hard route'],
			packs: ['Autumn pack'],
			preparedPacks: 0,
			starters: 1,
			grants: 2,
			corrections: 3,
		})
		for (const table of [
			'puzzles',
			'reward_palettes',
			'palette_pack_palettes',
			'starter_palettes',
			'palette_grants',
			'palette_corrections',
		]) {
			expect(filters).toHaveBeenCalledWith(table, 'palette_id', 'cabo')
		}
		expect(selects.mock.calls.flat().join(' ')).not.toMatch(
			/puzzle_authoring|known_solution|user_id/,
		)
		expect(selects).toHaveBeenCalledWith('palette_grants', 'palette_id', {
			count: 'exact',
			head: true,
		})
		expect(selects).toHaveBeenCalledWith(
			'reward_palettes',
			'reward_rule_id, reward_rules(puzzle_collections!reward_rules_collection_id_fkey(name), completion_routes!reward_rules_route_id_collection_id_fkey(name))',
			undefined,
		)
	})

	it('paginates puzzle, reward, and pack references without truncation', async () => {
		const { client, pages } = setup()
		for (const [table, range] of Object.entries(pages)) {
			const result =
				table === 'puzzles'
					? puzzle
					: table === 'reward_palettes'
						? {
								reward_rules: {
									puzzle_collections: { name: 'Set' },
									completion_routes: null,
								},
							}
						: { palette_packs: { name: 'Pack' } }
			range.mockResolvedValueOnce({
				data: Array(1000).fill(result),
				error: null,
			})
		}
		const usage = await loadPaletteUsage(client, 'cabo')
		expect(usage.puzzles).toHaveLength(1001)
		expect(usage.rewards).toHaveLength(1001)
		expect(usage.packs).toHaveLength(1001)
		for (const range of Object.values(pages))
			expect(range.mock.calls).toEqual([
				[0, 999],
				[1000, 1999],
			])
	})

	it('labels daily/unassigned puzzles and supports absent previews for other shapes', async () => {
		const { client, pages } = setup()
		pages.puzzles.mockResolvedValue({
			data: [
				{
					...puzzle,
					id: 'daily',
					usage: 'daily',
					collection_puzzles: [],
				},
				{
					...puzzle,
					id: 'other',
					shape_id: 'triangle',
					collection_puzzles: [],
				},
			],
			error: null,
		})
		const usage = await loadPaletteUsage(client, 'cabo')
		expect(usage.puzzles.map(value => value.context)).toEqual([
			'Daily',
			'Unassigned Set/pack',
		])
		expect(usage.puzzles[1].preview).toBeNull()
	})

	it.each(['puzzles', 'reward_palettes', 'palette_pack_palettes'] as const)(
		'fails explicitly for missing, erroneous, or unresolved %s data',
		async table => {
			const { client, pages } = setup()
			pages[table].mockResolvedValueOnce({
				data: null,
				error: { message: 'Offline' },
			})
			await expect(loadPaletteUsage(client, 'cabo')).rejects.toThrow(
				'Offline',
			)
			pages[table].mockResolvedValueOnce({ data: null, error: null })
			await expect(loadPaletteUsage(client, 'cabo')).rejects.toThrow(
				'returned no data',
			)
			const unresolved =
				table === 'puzzles'
					? {
							...puzzle,
							collection_puzzles: [{ puzzle_collections: null }],
						}
					: table === 'reward_palettes'
						? { reward_rules: null }
						: { palette_packs: null }
			pages[table].mockResolvedValueOnce({
				data: [unresolved],
				error: null,
			})
			await expect(loadPaletteUsage(client, 'cabo')).rejects.toThrow(
				'could not be resolved',
			)
		},
	)

	it.each([
		'starter_palettes',
		'palette_grants',
		'palette_corrections',
	] as const)(
		'fails rather than treating a missing %s count as zero',
		async table => {
			const { client, counts } = setup()
			counts[table].mockResolvedValueOnce({
				count: null,
				error: { message: 'Count offline' },
			})
			await expect(loadPaletteUsage(client, 'cabo')).rejects.toThrow(
				'Count offline',
			)
			counts[table].mockResolvedValueOnce({ count: null, error: null })
			await expect(loadPaletteUsage(client, 'cabo')).rejects.toThrow(
				'count was not returned',
			)
		},
	)

	it('rejects malformed saved puzzle slots rather than showing a fabricated preview', async () => {
		const { client, pages } = setup()
		pages.puzzles.mockResolvedValueOnce({
			data: [
				{
					...puzzle,
					definition: { ...definition, target: { '0,0': 5 } },
				},
			],
			error: null,
		})
		await expect(loadPaletteUsage(client, 'cabo')).rejects.toThrow(
			'Invalid puzzle palette slot',
		)
	})

	it('treats every reference kind as a deletion blocker', () => {
		const empty: PaletteUsage = {
			puzzles: [],
			rewards: [],
			packs: [],
			starters: 0,
			grants: 0,
			corrections: 0,
		}
		expect(paletteIsUsed(empty)).toBe(false)
		for (const usage of [
			{
				...empty,
				puzzles: [
					{ id: 'p', name: 'P', context: 'Daily', preview: null },
				],
			},
			{ ...empty, rewards: ['Reward'] },
			{ ...empty, packs: ['Pack'] },
			{ ...empty, starters: 1 },
			{ ...empty, grants: 1 },
			{ ...empty, corrections: 1 },
		])
			expect(paletteIsUsed(usage)).toBe(true)
	})

	it('permits draft organizational membership but blocks prepared set membership', async () => {
		const { client, pages, counts } = setup()
		pages.puzzles.mockResolvedValue({ data: [], error: null })
		pages.reward_palettes.mockResolvedValue({ data: [], error: null })
		for (const count of Object.values(counts))
			count.mockResolvedValue({ count: 0, error: null })
		expect(paletteIsUsed(await loadPaletteUsage(client, 'cabo'))).toBe(
			false,
		)
		pages.palette_pack_palettes.mockResolvedValue({
			data: [
				{
					pack_id: 'pack',
					palette_packs: {
						name: 'Prepared',
						published_at: '2026-01-01',
						release_at: '2099-01-01',
					},
				},
			],
			error: null,
		})
		const usage = await loadPaletteUsage(client, 'cabo')
		expect(usage.preparedPacks).toBe(1)
		expect(paletteIsUsed(usage)).toBe(true)
	})
})
