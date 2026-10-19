import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/supabase'
import {
	loadDraftSets,
	manageDraftSet,
	deleteDraftSet,
	type SetAction,
} from './puzzleSets'
import {
	generateAuthoredHexPuzzle,
	renderAuthoredHexPuzzle,
	HEX_PUZZLE_RECIPES,
} from '@/domain/puzzles'
import { puzzleDraftArgs } from './puzzleDrafts'

function client(value: object) {
	return value as SupabaseClient<Database>
}
const row = {
	id: 'set',
	name: 'First set',
	kind: 'core',
	shape_id: 'hexagon',
	selection_mode: 'any',
	published_at: null,
	release_at: null,
}
describe('draft set requests', () => {
	it('deletes exactly one set and requires an exact confirmation', async () => {
		const rpc = vi.fn().mockResolvedValue({ data: 'set', error: null })
		await deleteDraftSet(client({ rpc }), 'set')
		expect(rpc).toHaveBeenCalledExactlyOnceWith('delete_draft_set', {
			p_id: 'set',
		})
		for (const data of [null, 'wrong']) {
			rpc.mockResolvedValue({ data, error: null })
			await expect(
				deleteDraftSet(client({ rpc }), 'set'),
			).rejects.toThrow('not confirmed')
		}
		rpc.mockResolvedValue({
			data: null,
			error: { message: 'Remove reward dependencies' },
		})
		await expect(deleteDraftSet(client({ rpc }), 'set')).rejects.toThrow(
			'Remove reward dependencies',
		)
	})
	it('renders the first ordered member from its stored design and current palette, without regenerating its seed', async () => {
		const palette = {
			id: 'cabo',
			name: 'Cabo',
			colors: [
				'#112233',
				'#223344',
				'#334455',
				'#445566',
				'#556677',
			] as const,
		}
		const saved = generateAuthoredHexPuzzle(
			'set-preview',
			palette.id,
			HEX_PUZZLE_RECIPES[0],
		)
		const args = puzzleDraftArgs(
			'first',
			'First puzzle',
			'collection',
			saved,
		)
		const data = {
			id: args.p_id,
			name: args.p_name,
			shape_id: 'hexagon',
			palette_id: args.p_palette_id,
			usage: args.p_usage,
			board_size: args.p_board_size,
			rotation_allowed: args.p_rotation_allowed,
			difficulty: args.p_difficulty,
			definition: args.p_definition,
			published_at: null,
			release_at: null,
			puzzle_authoring: {
				puzzle_id: args.p_id,
				seed: 'different-seed',
				generator_version: args.p_generator_version,
				known_solution: args.p_known_solution,
			},
			palettes: palette,
		}
		const previewResult = vi.fn().mockResolvedValue({
			data: [data, { ...data, id: 'second' }],
			error: null,
		})
		const membersResult = vi.fn().mockResolvedValue({
			data: [
				{
					collection_id: 'set',
					puzzle_id: 'first',
					position: 1,
					puzzles: { name: 'First puzzle' },
				},
				{
					collection_id: 'set',
					puzzle_id: 'second',
					position: 2,
					puzzles: { name: 'Second puzzle' },
				},
			],
			error: null,
		})
		const previewQuery = { in: vi.fn(() => previewResult()) }
		const from = vi.fn((table: string) => ({
			select: () =>
				table === 'puzzles'
					? previewQuery
					: {
							eq: vi.fn().mockReturnThis(),
							in: vi.fn().mockReturnThis(),
							is: vi.fn().mockReturnThis(),
							order: vi.fn().mockReturnThis(),
							range:
								table === 'puzzle_collections'
									? vi.fn().mockResolvedValue({
											data: [row],
											error: null,
										})
									: membersResult,
						},
		}))
		const sets = await loadDraftSets(client({ from }), true)
		expect(sets[0].preview?.target).toEqual(
			renderAuthoredHexPuzzle(saved, palette).target,
		)
		expect(previewQuery.in).toHaveBeenCalledExactlyOnceWith('id', [
			'first',
			'second',
		])
		expect(sets[0].members.map(member => member.preview?.target)).toEqual([
			sets[0].preview?.target,
			sets[0].preview?.target,
		])
		previewResult.mockResolvedValueOnce({
			data: null,
			error: { message: 'Offline' },
		})
		await expect(loadDraftSets(client({ from }), true)).rejects.toThrow(
			'Offline',
		)
		previewResult.mockResolvedValueOnce({
			data: [{ ...data, palettes: null }],
			error: null,
		})
		await expect(loadDraftSets(client({ from }), true)).rejects.toThrow(
			'palette is unavailable',
		)
		previewResult.mockResolvedValueOnce({
			data: [{ ...data, palettes: { ...palette, colors: ['#112233'] } }],
			error: null,
		})
		await expect(loadDraftSets(client({ from }), true)).rejects.toThrow(
			'five six-digit hex colors',
		)
		membersResult.mockResolvedValueOnce({ data: [], error: null })
		previewResult.mockClear()
		expect(
			(await loadDraftSets(client({ from }), true))[0].preview,
		).toBeNull()
		expect(previewResult).not.toHaveBeenCalled()
	})
	it.each([
		[
			{ kind: 'create', name: ' Set ', role: 'paid' },
			{ p_name: 'Set', p_kind: 'paid' },
		],
		[{ kind: 'rename', name: ' Renamed ' }, { p_name: 'Renamed' }],
		[
			{ kind: 'append', puzzleIds: ['a', 'b'] },
			{ p_puzzle_ids: ['a', 'b'] },
		],
		[{ kind: 'remove', puzzleIds: ['a'] }, { p_puzzle_ids: ['a'] }],
		[
			{ kind: 'reorder', puzzleIds: ['b', 'a'] },
			{ p_puzzle_ids: ['b', 'a'] },
		],
	] satisfies [SetAction, object][])(
		'sends and verifies one atomic %j request',
		async (action, args) => {
			const rpc = vi.fn().mockResolvedValue({ data: 'set', error: null })
			await manageDraftSet(client({ rpc }), 'set', action)
			expect(rpc).toHaveBeenCalledExactlyOnceWith('manage_draft_set', {
				p_id: 'set',
				p_action: action.kind,
				...args,
			})
			rpc.mockResolvedValue({ data: 'wrong', error: null })
			await expect(
				manageDraftSet(client({ rpc }), 'set', action),
			).rejects.toThrow('not confirmed')
			rpc.mockResolvedValue({
				data: null,
				error: { message: 'Set is now scheduled' },
			})
			await expect(
				manageDraftSet(client({ rpc }), 'set', action),
			).rejects.toThrow('Set is now scheduled')
		},
	)
	it('paginates sets and their ordered members without truncating at 1000', async () => {
		const setsRange = vi
			.fn()
			.mockResolvedValueOnce({
				data: Array.from({ length: 1000 }, (_, i) => ({
					...row,
					id: `set-${i}`,
				})),
				error: null,
			})
			.mockResolvedValueOnce({
				data: [{ ...row, id: 'last' }],
				error: null,
			})
		const memberIn = vi.fn()
		const memberRange = vi.fn((start: number) => {
			const ids = memberIn.mock.lastCall?.[1] as string[]
			if (!ids.includes('set-0'))
				return Promise.resolve({ data: [], error: null })
			return Promise.resolve({
				data:
					start === 0
						? Array.from({ length: 1000 }, (_, i) => ({
								collection_id: 'set-0',
								puzzle_id: `p-${i}`,
								position: i + 1,
								puzzles: { name: `Puzzle ${i}` },
							}))
						: [
								{
									collection_id: 'set-0',
									puzzle_id: 'p-last',
									position: 1001,
									puzzles: { name: 'Last puzzle' },
								},
							],
				error: null,
			})
		})
		const makeQuery = (range: (start: number) => unknown) => ({
			eq: vi.fn().mockReturnThis(),
			is: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			range,
		})
		const query = makeQuery(setsRange)
		const from = vi.fn((table: string) => ({
			select: () => {
				if (table === 'puzzle_collections') return query
				const members = makeQuery(memberRange)
				return {
					...members,
					in: (column: string, ids: string[]) => {
						memberIn(column, ids)
						return members
					},
				}
			},
		}))
		const sets = await loadDraftSets(client({ from }))
		expect(sets).toHaveLength(1001)
		expect(query.is).toHaveBeenCalledWith('published_at', null)
		expect(query.eq).toHaveBeenCalledWith('shape_id', 'hexagon')
		expect(setsRange.mock.calls).toEqual([
			[0, 999],
			[1000, 1999],
		])
		const members = sets.find(set => set.row.id === 'set-0')?.members
		expect(members).toHaveLength(1001)
		expect(members?.[1000]).toEqual({
			puzzleId: 'p-last',
			position: 1001,
			name: 'Last puzzle',
			preview: null,
		})
		// 11 chunks of set IDs, plus a second page for the full chunk.
		expect(memberIn).toHaveBeenCalledTimes(12)
		expect(memberIn.mock.calls.every(([, ids]) => ids.length <= 100)).toBe(
			true,
		)
		expect(memberRange).toHaveBeenCalledWith(1000, 1999)
	})
	it.each([
		{ data: null, error: null },
		{ data: null, error: { message: 'Offline' } },
	])('does not hide set or membership read failures: %j', async result => {
		const query = {
			eq: vi.fn().mockReturnThis(),
			in: vi.fn().mockReturnThis(),
			is: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			range: vi.fn().mockResolvedValue(result),
		}
		const from = vi.fn().mockReturnValue({ select: () => query })
		await expect(loadDraftSets(client({ from }))).rejects.toThrow()
		const setQuery = {
			...query,
			range: vi.fn().mockResolvedValue({ data: [row], error: null }),
		}
		from.mockImplementation((table: string) => ({
			select: () => (table === 'puzzle_collections' ? setQuery : query),
		}))
		await expect(loadDraftSets(client({ from }))).rejects.toThrow()
	})
})
