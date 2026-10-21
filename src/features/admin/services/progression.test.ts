import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/supabase'
import {
	coreGroupsOf,
	loadProgression,
	manageGroupReward,
	manageShapeProgression,
	rewardOf,
	type ProgressionGroup,
} from './progression'

function client(value: object) {
	return value as SupabaseClient<Database>
}

const groupRow = (
	id: string,
	purpose: string,
	shape: string,
	track: string,
) => ({
	id,
	name: `Group ${id}`,
	purpose,
	shape_id: shape,
	track,
	published_at: null,
	release_at: null,
})

function setup(
	overrides: {
		shapes?: unknown
		groups?: unknown
		rules?: unknown
	} = {},
) {
	const results: Record<string, unknown> = {
		shape_progression: overrides.shapes ?? {
			data: [
				{ shape_id: 'hexagon', position: 1 },
				{ shape_id: 'triangle', position: 2 },
			],
			error: null,
		},
		puzzle_groups: overrides.groups ?? {
			data: [
				groupRow('basic', 'core', 'hexagon', 'basic'),
				groupRow('rotation', 'core', 'hexagon', 'rotation'),
				groupRow('bonus', 'reward', 'hexagon', 'basic'),
			],
			error: null,
		},
		reward_rules: overrides.rules ?? {
			data: [
				{
					id: 'rule',
					group_id: 'rotation',
					reward_palettes: [{ palette_id: 'cabo' }],
					reward_puzzle_groups: [{ group_id: 'bonus' }],
				},
			],
			error: null,
		},
	}
	const calls: unknown[][] = []
	const range = vi.fn((table: string) => Promise.resolve(results[table]))
	const from = vi.fn((table: string) => {
		const query = {
			select: (columns: string) => {
				calls.push([table, 'select', columns])
				return query
			},
			in: (column: string, values: string[]) => {
				calls.push([table, 'in', column, values])
				return query
			},
			order: (column: string) => {
				calls.push([table, 'order', column])
				// The shape order is not paged, so ordering ends the chain.
				return table === 'shape_progression'
					? Promise.resolve(results[table])
					: query
			},
			range: (...args: number[]) => {
				calls.push([table, 'range', ...args])
				return range(table)
			},
		}
		return query
	})
	return { client: client({ from }), calls, range, results }
}

describe('progression catalog', () => {
	it('loads the shape order, core and reward groups, and rewards', async () => {
		const { client, calls } = setup()
		const progression = await loadProgression(client)
		expect(progression.shapeIds).toEqual(['hexagon', 'triangle'])
		expect(progression.groups.map(group => group.id)).toEqual([
			'basic',
			'rotation',
			'bonus',
		])
		expect(progression.groups[0]).toEqual({
			id: 'basic',
			name: 'Group basic',
			purpose: 'core',
			shapeId: 'hexagon',
			track: 'basic',
			published: false,
		})
		expect(progression.rewards).toEqual([
			{
				groupId: 'rotation',
				paletteIds: ['cabo'],
				bonusGroupIds: ['bonus'],
			},
		])
		expect(progression.locked).toBe(false)
		expect(calls).toContainEqual([
			'puzzle_groups',
			'in',
			'purpose',
			['core', 'reward'],
		])
		expect(calls).toContainEqual(['shape_progression', 'order', 'position'])
	})

	it('locks the order once a core group is published, but not for a published reward group', async () => {
		const published = {
			published_at: '2026-01-01',
			release_at: '2099-01-01',
		}
		const bonus = setup({
			groups: {
				data: [
					{
						...groupRow('b', 'reward', 'hexagon', 'basic'),
						...published,
					},
				],
				error: null,
			},
		})
		expect((await loadProgression(bonus.client)).locked).toBe(false)
		const core = setup({
			groups: {
				data: [
					{
						...groupRow('c', 'core', 'hexagon', 'basic'),
						...published,
					},
				],
				error: null,
			},
		})
		const result = await loadProgression(core.client)
		expect(result.locked).toBe(true)
		expect(result.groups[0].published).toBe(true)
	})

	it('pages groups and rewards without truncating at 1000', async () => {
		const { client, range, results } = setup()
		const many = Array.from({ length: 1000 }, (_, index) =>
			groupRow(`g${index}`, 'reward', 'hexagon', 'basic'),
		)
		const pages = [
			{ data: many, error: null },
			{
				data: [groupRow('last', 'reward', 'hexagon', 'basic')],
				error: null,
			},
		]
		range.mockImplementation((table: string) =>
			Promise.resolve(
				table === 'puzzle_groups'
					? (pages.shift() ?? { data: [], error: null })
					: results[table],
			),
		)
		expect((await loadProgression(client)).groups).toHaveLength(1001)
	})

	it.each(['shapes', 'groups', 'rules'] as const)(
		'reports %s read errors and missing data explicitly',
		async key => {
			const failing = setup({
				[key]: { data: null, error: { message: 'Offline' } },
			})
			await expect(loadProgression(failing.client)).rejects.toThrow(
				'Offline',
			)
			const empty = setup({ [key]: { data: null, error: null } })
			await expect(loadProgression(empty.client)).rejects.toThrow(
				'returned no data',
			)
		},
	)

	it('rejects unsupported purposes and tracks', async () => {
		for (const row of [
			groupRow('a', 'pack', 'hexagon', 'basic'),
			groupRow('b', 'core', 'hexagon', 'mixed-up'),
		])
			await expect(
				loadProgression(
					setup({ groups: { data: [row], error: null } }).client,
				),
			).rejects.toThrow('unsupported')
	})
})

describe('progression writes', () => {
	it('confirms the exact shape order', async () => {
		const rpc = vi
			.fn()
			.mockResolvedValue({ data: ['triangle', 'hexagon'], error: null })
		await manageShapeProgression(client({ rpc }), ['triangle', 'hexagon'])
		expect(rpc).toHaveBeenCalledExactlyOnceWith(
			'manage_shape_progression',
			{
				p_shape_ids: ['triangle', 'hexagon'],
			},
		)
		for (const data of [null, ['hexagon', 'triangle'], ['triangle']]) {
			rpc.mockResolvedValue({ data, error: null })
			await expect(
				manageShapeProgression(client({ rpc }), [
					'triangle',
					'hexagon',
				]),
			).rejects.toThrow('not confirmed')
		}
		rpc.mockResolvedValue({
			data: null,
			error: { message: 'Order is locked' },
		})
		await expect(
			manageShapeProgression(client({ rpc }), ['triangle', 'hexagon']),
		).rejects.toThrow('Order is locked')
	})

	it('confirms one reward change per group', async () => {
		const rpc = vi.fn().mockResolvedValue({ data: 'rotation', error: null })
		await manageGroupReward(client({ rpc }), 'rotation', {
			paletteIds: ['cabo'],
			bonusGroupIds: ['a', 'b'],
		})
		expect(rpc).toHaveBeenCalledExactlyOnceWith('manage_group_reward', {
			p_group_id: 'rotation',
			p_palette_ids: ['cabo'],
			p_bonus_group_ids: ['a', 'b'],
		})
		rpc.mockResolvedValue({ data: 'other', error: null })
		await expect(
			manageGroupReward(client({ rpc }), 'rotation', {
				paletteIds: [],
				bonusGroupIds: [],
			}),
		).rejects.toThrow('not confirmed')
		rpc.mockResolvedValue({
			data: null,
			error: { message: 'Palette is not in a reward palette group' },
		})
		await expect(
			manageGroupReward(client({ rpc }), 'rotation', {
				paletteIds: ['x'],
				bonusGroupIds: [],
			}),
		).rejects.toThrow('not in a reward palette group')
	})
})

describe('progression helpers', () => {
	const group = (
		id: string,
		purpose: ProgressionGroup['purpose'],
		shapeId: string,
		track: ProgressionGroup['track'],
	): ProgressionGroup => ({
		id,
		name: id,
		purpose,
		shapeId,
		track,
		published: false,
	})

	it('finds the basic and rotation core group of a shape', () => {
		const groups = [
			group('a', 'core', 'hexagon', 'basic'),
			group('b', 'core', 'hexagon', 'rotation'),
			group('c', 'core', 'triangle', 'basic'),
			group('d', 'reward', 'triangle', 'rotation'),
		]
		expect(coreGroupsOf(groups, 'hexagon')).toEqual({
			basic: groups[0],
			rotation: groups[1],
		})
		expect(coreGroupsOf(groups, 'triangle')).toEqual({
			basic: groups[2],
			rotation: undefined,
		})
		expect(coreGroupsOf(groups, 'pinwheel')).toEqual({
			basic: undefined,
			rotation: undefined,
		})
	})

	it('reads a group reward, or an empty one', () => {
		const rewards = [{ groupId: 'a', paletteIds: ['p'], bonusGroupIds: [] }]
		expect(rewardOf({ rewards }, 'a')).toBe(rewards[0])
		expect(rewardOf({ rewards }, 'b')).toEqual({
			groupId: 'b',
			paletteIds: [],
			bonusGroupIds: [],
		})
	})
})
