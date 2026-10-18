import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database, Tables } from '../types/database'
import { generateAuthoredHexPuzzle } from '../puzzles/hexAuthoring'
import { HEX_PUZZLE_RECIPES, isPuzzleSolved } from '../puzzles/hexPuzzle'
import { renderAuthoredHexPuzzle } from '../puzzles/hexAuthoring'
import { readAuthoredHexPuzzle } from '../puzzles/readAuthoredHexPuzzle'
import { puzzleDraftArgs } from './puzzleDrafts'
import {
	deletePuzzleDraft,
	editPuzzleDraft,
	loadPuzzleDrafts,
} from './puzzleLibrary'

const palette = {
	id: 'cabo',
	name: 'Cabo',
	colors: ['#112233', '#223344', '#334455', '#445566', '#556677'] as const,
}
function fixture(
	recipe = HEX_PUZZLE_RECIPES[0] as (typeof HEX_PUZZLE_RECIPES)[number],
) {
	const original = generateAuthoredHexPuzzle('saved-seed', palette.id, recipe)
	const args = puzzleDraftArgs('id', 'Draft', 'collection', original)
	const row: Tables<'puzzles'> = {
		id: 'id',
		name: 'Draft',
		shape_id: 'hexagon',
		palette_id: palette.id,
		usage: 'collection',
		board_size: recipe.size,
		difficulty: recipe.difficulty,
		rotation_allowed: recipe.rotation,
		definition: args.p_definition,
		published_at: null,
		release_at: null,
	}
	const authoring: Tables<'puzzle_authoring'> = {
		puzzle_id: row.id,
		seed: args.p_seed,
		generator_version: args.p_generator_version,
		known_solution: args.p_known_solution,
	}
	return { original, row, authoring }
}
function mockClient(value: object) {
	return value as SupabaseClient<Database>
}
describe('saved puzzle decoding', () => {
	it.each(HEX_PUZZLE_RECIPES)(
		'reopens exact stored $id content without regeneration',
		recipe => {
			const { original, row, authoring } = fixture(recipe)
			// The seed intentionally no longer reproduces the stored design.
			const saved = readAuthoredHexPuzzle(row, {
				...authoring,
				seed: 'not-the-original-seed',
			})
			expect(saved.definition).toEqual(original.definition)
			const rendered = renderAuthoredHexPuzzle(saved, palette)
			expect(isPuzzleSolved(rendered, saved.knownSolution)).toBe(true)
		},
	)
	it('rejects missing authoring, unsupported versions, malformed slots and invalid solutions', () => {
		const { row, authoring } = fixture()
		expect(() => readAuthoredHexPuzzle(row, null)).toThrow('authoring')
		expect(() =>
			readAuthoredHexPuzzle(row, {
				...authoring,
				generator_version: 'future',
			}),
		).toThrow('generator')
		expect(() =>
			readAuthoredHexPuzzle(
				{ ...row, definition: { version: 1 } },
				authoring,
			),
		).toThrow()
		expect(() =>
			readAuthoredHexPuzzle(row, { ...authoring, known_solution: {} }),
		).toThrow()
		const definition = JSON.parse(JSON.stringify(row.definition))
		definition.target['0,0'] = 5
		expect(() =>
			readAuthoredHexPuzzle({ ...row, definition }, authoring),
		).toThrow('slot')
	})
})
describe('draft library database requests', () => {
	it('paginates drafts and correctly recognizes empty versus assigned relationships', async () => {
		const { row, authoring } = fixture()
		const base = {
			...row,
			puzzle_authoring: authoring,
			collection_puzzles: [],
			daily_puzzles: [],
		}
		const range = vi
			.fn()
			.mockResolvedValueOnce({
				data: Array.from({ length: 1000 }, (_, i) => ({
					...base,
					id: `id-${i}`,
				})),
				error: null,
			})
			.mockResolvedValueOnce({
				data: [
					{
						...base,
						id: 'set',
						collection_puzzles: [{ puzzle_id: 'set' }],
					},
					{
						...base,
						id: 'daily',
						daily_puzzles: [{ id: 'assignment' }],
					},
				],
				error: null,
			})
		const query = {
			eq: vi.fn().mockReturnThis(),
			is: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			range,
		}
		const from = vi.fn().mockReturnValue({ select: () => query })
		const drafts = await loadPuzzleDrafts(mockClient({ from }))
		expect(drafts).toHaveLength(1002)
		expect(drafts.find(value => value.row.id === 'id-0')?.assigned).toBe(
			false,
		)
		expect(drafts.find(value => value.row.id === 'set')?.assigned).toBe(
			true,
		)
		expect(drafts.find(value => value.row.id === 'daily')?.assigned).toBe(
			true,
		)
		expect(query.is).toHaveBeenCalledWith('published_at', null)
		expect(query.eq).toHaveBeenCalledWith('shape_id', 'hexagon')
		expect(range.mock.calls).toEqual([
			[0, 999],
			[1000, 1999],
		])
	})
	it('surfaces read and write errors and rejects unconfirmed mutations', async () => {
		const query = {
			eq: vi.fn().mockReturnThis(),
			is: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			range: vi
				.fn()
				.mockResolvedValue({
					data: null,
					error: { message: 'Offline' },
				}),
		}
		await expect(
			loadPuzzleDrafts(
				mockClient({ from: () => ({ select: () => query }) }),
			),
		).rejects.toThrow('Offline')
		const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
		await expect(
			editPuzzleDraft(
				mockClient({ rpc }),
				'id',
				' Name ',
				'palette',
				'daily',
			),
		).rejects.toThrow('not confirmed')
		expect(rpc).toHaveBeenCalledWith('edit_puzzle_draft', {
			p_id: 'id',
			p_name: 'Name',
			p_palette_id: 'palette',
			p_usage: 'daily',
		})
		rpc.mockResolvedValue({ data: null, error: { message: 'Assigned' } })
		await expect(
			deletePuzzleDraft(mockClient({ rpc }), 'id'),
		).rejects.toThrow('Assigned')
		rpc.mockResolvedValue({ data: null, error: null })
		await expect(
			deletePuzzleDraft(mockClient({ rpc }), 'id'),
		).rejects.toThrow('not confirmed')
	})
})
