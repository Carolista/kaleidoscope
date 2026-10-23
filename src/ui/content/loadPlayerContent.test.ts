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
			puzzles: puzzle,
		})),
		...extra,
	}
}

function fakeClient(
	data: Record<string, unknown>,
	failing?: string,
): SupabaseClient<Database> {
	return {
		from(table: string) {
			const result =
				table === failing
					? { data: null, error: { message: `${table} failed` } }
					: { data: data[table] ?? [], error: null }
			const query = {
				select: () => query,
				eq: () => query,
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
		expect(content.puzzleSets.map(set => set.id)).toEqual([
			'tri-basic',
			'hex-basic',
			'hex-rotation',
		])
	})

	it('defaults to Hexagon when no order is released', async () => {
		const content = await loadPlayerContent(fakeClient({}))
		expect(content).toEqual({
			palettes: [],
			unlockedShapes: ['hexagon'],
			puzzleSets: [],
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
		})
		expect(set.puzzles.map(item => item.id)).toEqual(['third'])
		expect(set.puzzles[0]).toMatchObject({
			name: 'Puzzle third',
			difficulty: 'easy',
		})
		expect(set.puzzles[0].puzzle.solution).toEqual({})
		expect(consoleError).toHaveBeenCalledOnce()
	})

	it('reports a failed read', async () => {
		await expect(
			loadPlayerContent(fakeClient({}, 'puzzle_groups')),
		).rejects.toThrow('puzzle_groups failed')
	})
})
