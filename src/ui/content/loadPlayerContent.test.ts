import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { PUZZLE_RECIPES, generateAuthoredPuzzle } from '@/domain/puzzles'
import { loadPlayerContent } from './loadPlayerContent'

const live = {
	published_at: '2026-01-01T00:00:00Z',
	release_at: '2026-01-01T00:00:00Z',
}
const draft = { published_at: null, release_at: null }
const scheduled = {
	published_at: '2026-01-01T00:00:00Z',
	release_at: '2999-01-01T00:00:00Z',
}
const colors = ['#a53f2b', '#f09f92', '#ffdccc', '#0f7173', '#124e5f']

function palette(id: string, extra = {}) {
	return { id, name: id.toUpperCase(), colors, ...live, ...extra }
}

function puzzle(id: string, extra = {}) {
	const recipe = PUZZLE_RECIPES[0]
	const authored = generateAuthoredPuzzle(id, 'p1', recipe, 'hexagon')
	return {
		id,
		name: `Puzzle ${id}`,
		shape_id: 'hexagon',
		board_size: recipe.size,
		difficulty: recipe.difficulty,
		rotation_allowed: recipe.rotation,
		palette_id: 'p1',
		definition: JSON.parse(JSON.stringify(authored.definition)),
		...live,
		palettes: palette('p1'),
		...extra,
	}
}

function group(
	id: string,
	members: readonly (object | null)[],
	extra: Record<string, unknown> = {},
) {
	return {
		id,
		name: id,
		shape_id: 'hexagon',
		track: 'basic',
		...live,
		puzzle_group_members: members.map((puzzle, index) => ({
			position: index + 1,
			puzzle_id: (puzzle as { id?: string } | null)?.id ?? null,
			puzzles: puzzle,
		})),
		...extra,
	}
}

function fakeClient(
	data: Record<string, unknown>,
	failing?: string,
	rpc: () => Promise<{
		data: unknown
		error: { message: string } | null
	}> = () => Promise.resolve({ data: [], error: null }),
	filters: [string, string, unknown][] = [],
): SupabaseClient<Database> {
	return {
		rpc,
		from(table: string) {
			const result =
				table === failing
					? { data: null, error: { message: `${table} failed` } }
					: { data: data[table] ?? [], error: null }
			const query = {
				select: () => query,
				eq: (column: string, value: unknown) => {
					filters.push([table, column, value])
					return query
				},
				in: () => query,
				order: () => query,
				then: (resolve: (value: typeof result) => unknown) =>
					Promise.resolve(result).then(resolve),
			}
			return query
		},
	} as unknown as SupabaseClient<Database>
}

afterEach(() => vi.restoreAllMocks())

describe('loadPlayerContent', () => {
	it('lists live core palettes by group name, then position, without repeats or drafts', async () => {
		const content = await loadPlayerContent(
			fakeClient({
				palette_groups: [
					{
						id: 'g2',
						name: 'B group',
						...live,
						palette_group_members: [
							{ position: 1, palettes: palette('b1') },
						],
					},
					{
						id: 'g1',
						name: 'A group',
						...live,
						palette_group_members: [
							{ position: 2, palettes: palette('a2') },
							{ position: 1, palettes: palette('b1') },
							{ position: 3, palettes: palette('a3', draft) },
							{ position: 4, palettes: palette('a4', scheduled) },
							{
								position: 5,
								palettes: palette('a5', { colors: ['#fff'] }),
							},
							{ position: 6, palettes: null },
						],
					},
					{
						id: 'g3',
						name: 'Draft group',
						...draft,
						palette_group_members: [
							{ position: 1, palettes: palette('hidden') },
						],
					},
				],
			}),
		)
		expect(content.palettes.map(item => item.id)).toEqual(['b1', 'a2'])
		expect(content.palettes[0]).toEqual({
			id: 'b1',
			name: 'B1',
			colors,
		})
	})

	it('offers only the first shape and orders sets by shape, then basic before rotation', async () => {
		const content = await loadPlayerContent(
			fakeClient({
				shape_progression: [
					{ shape_id: 'triangle', position: 1 },
					{ shape_id: 'hexagon', position: 2 },
				],
				puzzle_groups: [
					group('hex-rotation', [puzzle('a')], { track: 'rotation' }),
					group('hex-basic', [puzzle('b')]),
					group('tri-basic', [puzzle('c')], { shape_id: 'triangle' }),
				],
			}),
		)
		expect(content.unlockedShapes).toEqual(['triangle'])
		expect(content.nextShape).toBe('hexagon')
		expect(content.puzzleSets.map(set => set.id)).toEqual([
			'tri-basic',
			'hex-basic',
			'hex-rotation',
		])
	})

	it('opens the next shape for an account that finished a core group, and a granted shape', async () => {
		const progression = {
			shape_progression: [
				'hexagon',
				'triangle',
				'diamondStar',
				'hexagram',
			].map((shape_id, index) => ({ shape_id, position: index + 1 })),
		}
		const completed = (shape_id: string, purpose: string) => ({
			puzzle_groups: { shape_id, purpose },
		})
		const content = await loadPlayerContent(
			fakeClient({
				...progression,
				group_completions: [
					completed('hexagon', 'core'),
					// A bonus group opens nothing; neither does a completion that cannot be read.
					completed('triangle', 'reward'),
					{ puzzle_groups: null },
				],
				shape_grants: [{ shape_id: 'hexagram' }],
			}),
			{ account: { userId: 'user-1' } },
		)
		expect(content.unlockedShapes).toEqual([
			'hexagon',
			'triangle',
			'hexagram',
		])
		const guest = await loadPlayerContent(
			fakeClient({
				...progression,
				group_completions: [completed('hexagon', 'core')],
			}),
		)
		expect(guest.unlockedShapes).toEqual(['hexagon'])
		expect(guest.nextShape).toBe('triangle')
		expect(content.nextShape).toBe('diamondStar')
	})

	it("asks only for the signed-in player's own progress", async () => {
		const filters: [string, string, unknown][] = []
		await loadPlayerContent(fakeClient({}, undefined, undefined, filters), {
			account: { userId: 'user-1' },
		})
		for (const table of [
			'group_completions',
			'shape_grants',
			'feature_grants',
		])
			expect(filters).toContainEqual([table, 'user_id', 'user-1'])
	})

	it("reports a failure to read an account's progress", async () => {
		await expect(
			loadPlayerContent(fakeClient({}, 'group_completions'), {
				account: { userId: 'user-1' },
			}),
		).rejects.toThrow('group_completions failed')
	})

	it('defaults to Hexagon when no order is released', async () => {
		const content = await loadPlayerContent(fakeClient({}))
		expect(content).toEqual({
			palettes: [],
			lockedPalettes: [],
			lockedPuzzleSets: [],
			unlockedShapes: ['hexagon'],
			shapeOrder: ['hexagon'],
			nextShape: null,
			randomizerUnlocked: false,
			puzzleSets: [],
			rewards: [],
		})
	})

	it('keeps puzzles in group order and drops what a guest cannot play', async () => {
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {})
		const content = await loadPlayerContent(
			fakeClient({
				puzzle_groups: [
					group('set', [
						puzzle('third'),
						null,
						puzzle('draft', draft),
						puzzle('scheduled', scheduled),
						puzzle('no-palette', { palettes: null }),
						puzzle('broken', { definition: { version: 1 } }),
					]),
					group('unreleased', [puzzle('x')], draft),
					group('empty', [null]),
					group('pack-shape', [puzzle('y')], { shape_id: 'blob' }),
					group('mixed', [puzzle('z')], { track: 'mixed' }),
				],
			}),
		)
		expect(content.puzzleSets).toHaveLength(1)
		const [set] = content.puzzleSets
		expect(set).toMatchObject({
			id: 'set',
			shape: 'hexagon',
			track: 'basic',
			kind: 'core',
		})
		expect(set.puzzles.map(item => item.id)).toEqual(['third'])
		expect(set.puzzles[0]).toMatchObject({
			name: 'Puzzle Third',
			difficulty: 'easy',
		})
		expect(set.puzzles[0].puzzle.solution).toEqual({})
		expect(consoleError).toHaveBeenCalledOnce()
	})

	it('shows set, puzzle, and palette names in title case', async () => {
		const content = await loadPlayerContent(
			fakeClient({
				puzzle_groups: [
					group(
						'set',
						[
							puzzle('one', {
								name: 'a walk in the park',
								palettes: palette('p1', {
									name: ' sunset over the sea ',
								}),
							}),
						],
						{ name: 'hexagon basics' },
					),
				],
			}),
		)
		const [set] = content.puzzleSets
		expect(set.name).toBe('Hexagon Basics')
		expect(set.puzzles[0].name).toBe('A Walk in the Park')
		expect(set.puzzles[0].palette.name).toBe('Sunset Over the Sea')
	})

	it('loads bonus sets after their core set and the rewards that link them', async () => {
		const content = await loadPlayerContent(
			fakeClient({
				puzzle_groups: [
					group('bonus', [puzzle('b')], { purpose: 'reward' }),
					group('core-rotation', [puzzle('r')], {
						track: 'rotation',
					}),
					group('core', [puzzle('c')], { purpose: 'core' }),
					group('lost-bonus', [null], { purpose: 'reward' }),
				],
				reward_rules: [
					{
						group_id: 'core-rotation',
						reward_palettes: [{ palettes: palette('p2') }],
						reward_puzzle_groups: [
							{ group_id: 'bonus' },
							{ group_id: 'lost-bonus' },
						],
					},
					{
						group_id: 'core',
						reward_palettes: [
							{ palettes: palette('p1') },
							{ palettes: palette('draft', draft) },
						],
						reward_puzzle_groups: [{ group_id: 'bonus' }],
					},
					{
						group_id: 'elsewhere',
						reward_palettes: [{ palettes: palette('p3') }],
						reward_puzzle_groups: [],
					},
					{
						group_id: 'empty',
						reward_palettes: [],
						reward_puzzle_groups: [],
					},
				],
			}),
		)
		expect(
			content.puzzleSets.map(set => [set.id, set.kind, set.track]),
		).toEqual([
			['core', 'core', 'basic'],
			['core-rotation', 'core', 'rotation'],
			['bonus', 'bonus', 'basic'],
		])
		expect(
			content.rewards.map(reward => [
				reward.setId,
				reward.palettes.map(item => item.id),
				reward.bonusSetIds,
			]),
		).toEqual([
			['core', ['p1'], ['bonus']],
			['core-rotation', ['p2'], ['bonus']],
		])
	})

	it('fills in the puzzles an account is previewed, and asks only for an account', async () => {
		const { palettes: _embedded, ...preview } = puzzle('pv')
		void _embedded
		const previewGroup = {
			...group('bonus', [null], { purpose: 'reward' }),
			puzzle_group_members: [
				{ position: 1, puzzle_id: 'pv', puzzles: null },
			],
		}
		const data = {
			puzzle_groups: [previewGroup],
			palettes: [palette('p1')],
		}
		const rpc = vi.fn(() =>
			Promise.resolve({ data: [preview], error: null }),
		)

		const account = await loadPlayerContent(
			fakeClient(data, undefined, rpc),
			{
				account: { userId: 'user-1' },
			},
		)
		expect(rpc).toHaveBeenCalledWith('preview_puzzles')
		expect(account.puzzleSets.map(set => set.id)).toEqual(['bonus'])
		expect(account.puzzleSets[0].puzzles.map(item => item.id)).toEqual([
			'pv',
		])
		expect(account.puzzleSets[0].puzzles[0].palette.id).toBe('p1')

		rpc.mockClear()
		const guest = await loadPlayerContent(fakeClient(data, undefined, rpc))
		expect(rpc).not.toHaveBeenCalled()
		expect(guest.puzzleSets).toEqual([])
	})

	it('still loads when the previews cannot be read', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined)
		const content = await loadPlayerContent(
			fakeClient(
				{ puzzle_groups: [group('core', [puzzle('c')])] },
				undefined,
				() =>
					Promise.resolve({
						data: null,
						error: { message: 'missing' },
					}),
			),
			{ account: { userId: 'user-1' } },
		)
		expect(content.puzzleSets.map(set => set.id)).toEqual(['core'])
	})

	it('reports a failed read', async () => {
		await expect(
			loadPlayerContent(fakeClient({}, 'puzzle_groups')),
		).rejects.toThrow('puzzle_groups failed')
		await expect(
			loadPlayerContent(fakeClient({}, 'reward_rules')),
		).rejects.toThrow('reward_rules failed')
	})
})
