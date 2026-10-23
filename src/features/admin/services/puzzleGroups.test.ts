import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/supabase'
import {
	loadPuzzleGroups,
	managePuzzleGroup,
	type PuzzleGroupAction,
} from './puzzleGroups'
import {
	generateAuthoredPuzzle,
	renderAuthoredPuzzle,
	PUZZLE_RECIPES,
} from '@/domain/puzzles'
import { puzzleDraftArgs } from './puzzleDrafts'

function client(value: object) {
	return value as SupabaseClient<Database>
}
const row = {
	id: 'group',
	name: 'First group',
	purpose: 'core',
	track: 'basic',
	shape_id: 'hexagon',
	selection_mode: 'any',
	published_at: null,
	release_at: null,
}
describe('puzzle group requests', () => {
	it('loads daily groups, which have no shape or track', async () => {
		const range = vi.fn().mockResolvedValue({
			data: [
				{
					...row,
					id: 'daily',
					purpose: 'daily',
					shape_id: null,
					track: null,
				},
			],
			error: null,
		})
		const query = {
			in: vi.fn().mockReturnThis(),
			is: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			range,
		}
		const members = {
			in: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			range: vi.fn().mockResolvedValue({ data: [], error: null }),
		}
		const from = vi.fn((table: string) => ({
			select: () => (table === 'puzzle_groups' ? query : members),
		}))
		const groups = await loadPuzzleGroups(client({ from }))
		expect(groups).toHaveLength(1)
		expect(groups[0]).toMatchObject({ purpose: 'daily', track: null })
		expect(groups[0].row.shape_id).toBeNull()
		expect(query.in).not.toHaveBeenCalledWith('shape_id', expect.anything())
	})
	it.each([{ purpose: 'paid' }, { track: 'sideways' }])(
		'rejects a group with an unsupported value: %j',
		async change => {
			const range = vi.fn().mockResolvedValue({
				data: [{ ...row, ...change }],
				error: null,
			})
			const query = {
				is: vi.fn().mockReturnThis(),
				order: vi.fn().mockReturnThis(),
				range,
			}
			const from = vi.fn(() => ({ select: () => query }))
			await expect(loadPuzzleGroups(client({ from }))).rejects.toThrow(
				'unsupported',
			)
		},
	)
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
		const saved = generateAuthoredPuzzle(
			'set-preview',
			palette.id,
			PUZZLE_RECIPES[0],
			'hexagon',
		)
		const args = puzzleDraftArgs('first', 'First puzzle', saved)
		const data = {
			id: args.p_id,
			name: args.p_name,
			shape_id: 'hexagon',
			palette_id: args.p_palette_id,
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
					group_id: 'group',
					puzzle_id: 'first',
					position: 1,
					puzzles: { name: 'First puzzle' },
				},
				{
					group_id: 'group',
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
								table === 'puzzle_groups'
									? vi.fn().mockResolvedValue({
											data: [row],
											error: null,
										})
									: membersResult,
						},
		}))
		const groups = await loadPuzzleGroups(client({ from }), true)
		expect(groups[0].preview?.target).toEqual(
			renderAuthoredPuzzle(saved, palette).target,
		)
		expect(previewQuery.in).toHaveBeenCalledExactlyOnceWith('id', [
			'first',
			'second',
		])
		expect(groups[0].members.map(member => member.preview?.target)).toEqual(
			[groups[0].preview?.target, groups[0].preview?.target],
		)
		previewResult.mockResolvedValueOnce({
			data: null,
			error: { message: 'Offline' },
		})
		await expect(loadPuzzleGroups(client({ from }), true)).rejects.toThrow(
			'Offline',
		)
		previewResult.mockResolvedValueOnce({
			data: [{ ...data, palettes: null }],
			error: null,
		})
		await expect(loadPuzzleGroups(client({ from }), true)).rejects.toThrow(
			'palette is unavailable',
		)
		previewResult.mockResolvedValueOnce({
			data: [{ ...data, palettes: { ...palette, colors: ['#112233'] } }],
			error: null,
		})
		await expect(loadPuzzleGroups(client({ from }), true)).rejects.toThrow(
			'five six-digit hex colors',
		)
		membersResult.mockResolvedValueOnce({ data: [], error: null })
		previewResult.mockClear()
		expect(
			(await loadPuzzleGroups(client({ from }), true))[0].preview,
		).toBeNull()
		expect(previewResult).not.toHaveBeenCalled()
	})
	it.each([
		[
			{
				kind: 'create',
				name: ' Pack ',
				details: { purpose: 'pack', shape: 'triangle', track: 'mixed' },
			},
			{
				p_name: 'Pack',
				p_purpose: 'pack',
				p_shape_id: 'triangle',
				p_track: 'mixed',
			},
		],
		[
			{
				kind: 'create',
				name: 'October',
				details: { purpose: 'daily', shape: null, track: null },
			},
			{ p_name: 'October', p_purpose: 'daily' },
		],
		[
			{
				kind: 'update',
				name: ' Renamed ',
				details: {
					purpose: 'core',
					shape: 'hexagon',
					track: 'rotation',
				},
			},
			{
				p_name: 'Renamed',
				p_purpose: 'core',
				p_shape_id: 'hexagon',
				p_track: 'rotation',
			},
		],
		[
			{ kind: 'append', puzzleIds: ['a', 'b'] },
			{ p_puzzle_ids: ['a', 'b'] },
		],
		[{ kind: 'remove', puzzleIds: ['a'] }, { p_puzzle_ids: ['a'] }],
		[
			{ kind: 'reorder', puzzleIds: ['b', 'a'] },
			{ p_puzzle_ids: ['b', 'a'] },
		],
		[{ kind: 'delete' }, {}],
	] satisfies [PuzzleGroupAction, object][])(
		'sends and verifies one atomic %j request',
		async (action, args) => {
			const rpc = vi
				.fn()
				.mockResolvedValue({ data: 'group', error: null })
			await managePuzzleGroup(client({ rpc }), 'group', action)
			expect(rpc).toHaveBeenCalledExactlyOnceWith('manage_puzzle_group', {
				p_id: 'group',
				p_action: action.kind,
				...args,
			})
			rpc.mockResolvedValue({ data: 'wrong', error: null })
			await expect(
				managePuzzleGroup(client({ rpc }), 'group', action),
			).rejects.toThrow('not confirmed')
			rpc.mockResolvedValue({
				data: null,
				error: { message: 'Group is now scheduled' },
			})
			await expect(
				managePuzzleGroup(client({ rpc }), 'group', action),
			).rejects.toThrow('Group is now scheduled')
		},
	)
	it('paginates groups and their ordered members without truncating at 1000', async () => {
		const groupsRange = vi
			.fn()
			.mockResolvedValueOnce({
				data: Array.from({ length: 1000 }, (_, i) => ({
					...row,
					id: `group-${i}`,
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
			if (!ids.includes('group-0'))
				return Promise.resolve({ data: [], error: null })
			return Promise.resolve({
				data:
					start === 0
						? Array.from({ length: 1000 }, (_, i) => ({
								group_id: 'group-0',
								puzzle_id: `p-${i}`,
								position: i + 1,
								puzzles: { name: `Puzzle ${i}` },
							}))
						: [
								{
									group_id: 'group-0',
									puzzle_id: 'p-last',
									position: 1001,
									puzzles: { name: 'Last puzzle' },
								},
							],
				error: null,
			})
		})
		const makeQuery = (range: (start: number) => unknown) => ({
			in: vi.fn().mockReturnThis(),
			is: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			range,
		})
		const query = makeQuery(groupsRange)
		const from = vi.fn((table: string) => ({
			select: () => {
				if (table === 'puzzle_groups') return query
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
		const groups = await loadPuzzleGroups(client({ from }))
		expect(groups).toHaveLength(1001)
		expect(query.is).not.toHaveBeenCalled()
		expect(groupsRange.mock.calls).toEqual([
			[0, 999],
			[1000, 1999],
		])
		const members = groups.find(
			group => group.row.id === 'group-0',
		)?.members
		expect(members).toHaveLength(1001)
		expect(members?.[1000]).toEqual({
			puzzleId: 'p-last',
			position: 1001,
			name: 'Last puzzle',
			preview: null,
		})
		// 11 chunks of group IDs, plus a second page for the full chunk.
		expect(memberIn).toHaveBeenCalledTimes(12)
		expect(memberIn.mock.calls.every(([, ids]) => ids.length <= 100)).toBe(
			true,
		)
		expect(memberRange).toHaveBeenCalledWith(1000, 1999)
	})
	it.each([
		{ data: null, error: null },
		{ data: null, error: { message: 'Offline' } },
	])('does not hide group or membership read failures: %j', async result => {
		const query = {
			eq: vi.fn().mockReturnThis(),
			in: vi.fn().mockReturnThis(),
			is: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			range: vi.fn().mockResolvedValue(result),
		}
		const from = vi.fn().mockReturnValue({ select: () => query })
		await expect(loadPuzzleGroups(client({ from }))).rejects.toThrow()
		const groupQuery = {
			...query,
			range: vi.fn().mockResolvedValue({ data: [row], error: null }),
		}
		from.mockImplementation((table: string) => ({
			select: () => (table === 'puzzle_groups' ? groupQuery : query),
		}))
		await expect(loadPuzzleGroups(client({ from }))).rejects.toThrow()
	})
})
