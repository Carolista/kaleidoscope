import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { HEX_PUZZLE_RECIPES, generateAuthoredHexPuzzle } from '@/domain/puzzles'
import {
	loadSavedPuzzleSeeds,
	puzzleDraftArgs,
	savePuzzleDraft,
} from './puzzleDrafts'

function clientWith(query: object) {
	return query as SupabaseClient<Database>
}

describe('puzzle draft requests', () => {
	it.each(HEX_PUZZLE_RECIPES)(
		'serializes complete $id definitions and private solutions separately',
		recipe => {
			const puzzle = generateAuthoredHexPuzzle('seed', 'palette', recipe)
			const args = puzzleDraftArgs('id', '  Draft  ', 'daily', puzzle)
			expect(args).toMatchObject({
				p_name: 'Draft',
				p_usage: 'daily',
				p_board_size: recipe.size,
				p_rotation_allowed: recipe.rotation,
				p_difficulty: recipe.difficulty,
				p_definition: puzzle.definition,
				p_known_solution: puzzle.knownSolution,
			})
			expect(JSON.parse(JSON.stringify(args.p_definition))).toEqual(
				puzzle.definition,
			)
			expect(args.p_definition).not.toHaveProperty('seed')
			expect(args.p_definition).not.toHaveProperty('knownSolution')
		},
	)

	it('paginates saved seeds and scopes exclusions to shape and exact recipe, not palette or intended use', async () => {
		const range = vi
			.fn()
			.mockResolvedValueOnce({
				data: Array.from({ length: 1000 }, (_, i) => ({
					seed: `seed-${i}`,
				})),
				error: null,
			})
			.mockResolvedValueOnce({ data: [{ seed: 'last' }], error: null })
		const query = {
			eq: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			range,
		}
		const select = vi.fn().mockReturnValue(query)
		const from = vi.fn().mockReturnValue({ select })
		const seeds = await loadSavedPuzzleSeeds(
			clientWith({ from }),
			HEX_PUZZLE_RECIPES[1],
		)
		expect(seeds.size).toBe(1001)
		expect(seeds.has('last')).toBe(true)
		expect(range.mock.calls).toEqual([
			[0, 999],
			[1000, 1999],
		])
		expect(query.eq.mock.calls.slice(0, 4)).toEqual([
			['puzzles.shape_id', 'hexagon'],
			['puzzles.board_size', 'sm'],
			['puzzles.rotation_allowed', true],
			['puzzles.difficulty', 'moderate'],
		])
		expect(from).toHaveBeenCalledWith('puzzle_authoring')
	})

	it('rejects missing seed data or an unconfirmed save instead of reporting success', async () => {
		const query = {
			eq: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			range: vi.fn().mockResolvedValue({ data: null, error: null }),
		}
		await expect(
			loadSavedPuzzleSeeds(
				clientWith({ from: () => ({ select: () => query }) }),
				HEX_PUZZLE_RECIPES[0],
			),
		).rejects.toThrow('returned no data')
		const args = puzzleDraftArgs(
			'id',
			'Draft',
			'collection',
			generateAuthoredHexPuzzle('seed', 'palette', HEX_PUZZLE_RECIPES[0]),
		)
		await expect(
			savePuzzleDraft(
				clientWith({
					rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
				}),
				args,
			),
		).rejects.toThrow('expected puzzle ID')
	})
})
