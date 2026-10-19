import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database, Tables } from '@/lib/supabase'
import {
	generateAuthoredPuzzle,
	PUZZLE_RECIPES,
	PUZZLE_SHAPE_IDS,
	isPuzzleSolved,
	type PuzzleShapeId,
	renderAuthoredPuzzle,
	readAuthoredPuzzle,
} from '@/domain/puzzles'
import { puzzleDraftArgs } from './puzzleDrafts'
import {
	deletePuzzleDraft,
	editPuzzleDraft,
	loadPuzzleDrafts,
	bulkPuzzleDrafts,
	replacePuzzleDraft,
} from './puzzleLibrary'

const palette = {
	id: 'cabo',
	name: 'Cabo',
	colors: ['#112233', '#223344', '#334455', '#445566', '#556677'] as const,
}
function fixture(
	recipe = PUZZLE_RECIPES[0] as (typeof PUZZLE_RECIPES)[number],
	shape: PuzzleShapeId = 'hexagon',
) {
	const original = generateAuthoredPuzzle(
		'saved-seed',
		palette.id,
		recipe,
		shape,
	)
	const args = puzzleDraftArgs('id', 'Draft', 'collection', original)
	const row: Tables<'puzzles'> = {
		id: 'id',
		name: 'Draft',
		shape_id: args.p_shape_id,
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
	it.each(
		PUZZLE_SHAPE_IDS.flatMap(shape =>
			PUZZLE_RECIPES.map(recipe => ({ shape, recipe, id: recipe.id })),
		),
	)(
		'reopens exact stored $shape $id content without regeneration',
		({ shape, recipe }) => {
			const { original, row, authoring } = fixture(recipe, shape)
			// The seed intentionally no longer reproduces the stored design.
			const saved = readAuthoredPuzzle(row, {
				...authoring,
				seed: 'not-the-original-seed',
			})
			expect(saved).toMatchObject({
				shape,
				recipe,
				generatorVersion: original.generatorVersion,
				definition: original.definition,
			})
			const rendered = renderAuthoredPuzzle(saved, palette)
			expect(isPuzzleSolved(rendered, saved.knownSolution)).toBe(true)
		},
	)
	it('rejects missing authoring, unsupported versions, malformed slots and invalid solutions', () => {
		const { row, authoring } = fixture()
		expect(() => readAuthoredPuzzle(row, null)).toThrow('authoring')
		expect(() =>
			readAuthoredPuzzle(row, {
				...authoring,
				generator_version: 'future',
			}),
		).toThrow('generator')
		expect(() =>
			readAuthoredPuzzle(
				{ ...row, definition: { version: 1 } },
				authoring,
			),
		).toThrow()
		expect(() =>
			readAuthoredPuzzle(row, { ...authoring, known_solution: {} }),
		).toThrow()
		const definition = JSON.parse(JSON.stringify(row.definition))
		definition.target['0,0'] = 5
		expect(() =>
			readAuthoredPuzzle({ ...row, definition }, authoring),
		).toThrow('slot')
	})
	it('rejects diamond-star solutions that are not half turns', () => {
		const { row, authoring } = fixture(
			PUZZLE_RECIPES.find(recipe => recipe.rotation)!,
			'diamondStar',
		)
		expect(readAuthoredPuzzle(row, authoring).generatorVersion).toBe(
			'diamondStar-v1',
		)
		const solution = JSON.parse(JSON.stringify(authoring.known_solution))
		const [id] = Object.keys(solution)
		solution[id].rotation = 1
		expect(() =>
			readAuthoredPuzzle(row, { ...authoring, known_solution: solution }),
		).toThrow('rotation')
	})
	it('rejects triangle data stored with hexagon geometry, sizes or generator', () => {
		const { row, authoring } = fixture(PUZZLE_RECIPES[0], 'triangle')
		expect(row.definition).toMatchObject({ geometry: { size: 4 } })
		expect(authoring.generator_version).toBe('triangle-v1')
		expect(() =>
			readAuthoredPuzzle(row, {
				...authoring,
				generator_version: 'hexagon-v2',
			}),
		).toThrow('generator')
		const definition = JSON.parse(JSON.stringify(row.definition))
		definition.geometry = { radius: 4 }
		expect(() =>
			readAuthoredPuzzle({ ...row, definition }, authoring),
		).toThrow()
		definition.geometry = { size: 7 }
		expect(() =>
			readAuthoredPuzzle({ ...row, definition }, authoring),
		).toThrow()
		expect(() =>
			readAuthoredPuzzle({ ...row, shape_id: 'square' }, authoring),
		).toThrow('unsupported authoring')
	})
})
describe('draft library database requests', () => {
	it('replaces the exact preview and private solution atomically under the existing ID', async () => {
		const { original } = fixture(PUZZLE_RECIPES[3])
		const rpc = vi.fn().mockResolvedValue({ data: 'id', error: null })
		await replacePuzzleDraft(
			mockClient({ rpc }),
			'id',
			' Replacement ',
			'daily',
			original,
		)
		expect(rpc).toHaveBeenCalledExactlyOnceWith(
			'replace_puzzle_draft',
			puzzleDraftArgs('id', 'Replacement', 'daily', original),
		)
		rpc.mockResolvedValue({ data: 'wrong-id', error: null })
		await expect(
			replacePuzzleDraft(
				mockClient({ rpc }),
				'id',
				'Name',
				'daily',
				original,
			),
		).rejects.toThrow('not confirmed')
		rpc.mockResolvedValue({
			data: null,
			error: { message: 'Unassign the puzzle' },
		})
		await expect(
			replacePuzzleDraft(
				mockClient({ rpc }),
				'id',
				'Name',
				'daily',
				original,
			),
		).rejects.toThrow('Unassign the puzzle')
	})
	it('sends one atomic bulk request and requires confirmation of every selected ID', async () => {
		const rpc = vi.fn().mockResolvedValue({ data: ['b', 'a'], error: null })
		await bulkPuzzleDrafts(mockClient({ rpc }), ['a', 'b'], {
			kind: 'palette',
			paletteId: 'cabo',
		})
		expect(rpc).toHaveBeenCalledExactlyOnceWith('bulk_puzzle_drafts', {
			p_ids: ['a', 'b'],
			p_action: 'palette',
			p_palette_id: 'cabo',
		})
		rpc.mockResolvedValue({ data: ['a', 'b'], error: null })
		await bulkPuzzleDrafts(mockClient({ rpc }), ['a', 'b'], {
			kind: 'delete',
		})
		expect(rpc).toHaveBeenLastCalledWith('bulk_puzzle_drafts', {
			p_ids: ['a', 'b'],
			p_action: 'delete',
		})
		for (const data of [null, ['a'], ['a', 'a'], ['a', 'c']]) {
			rpc.mockResolvedValue({ data, error: null })
			await expect(
				bulkPuzzleDrafts(mockClient({ rpc }), ['a', 'b'], {
					kind: 'delete',
				}),
			).rejects.toThrow('not confirmed')
		}
		rpc.mockResolvedValue({
			data: null,
			error: { message: 'Assigned draft: Example' },
		})
		await expect(
			bulkPuzzleDrafts(mockClient({ rpc }), ['a', 'b'], {
				kind: 'delete',
			}),
		).rejects.toThrow('Assigned draft: Example')
	})
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
						collection_puzzles: [
							{
								puzzle_id: 'set',
								position: 3,
								puzzle_collections: {
									name: 'First set',
									kind: 'core',
								},
							},
						],
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
			in: vi.fn().mockReturnThis(),
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
		expect(
			drafts.find(value => value.row.id === 'set')?.collectionName,
		).toBe('First set')
		expect(
			drafts.find(value => value.row.id === 'set')?.collectionKind,
		).toBe('core')
		expect(
			drafts.find(value => value.row.id === 'set')?.collectionPosition,
		).toBe(3)
		expect(
			drafts.find(value => value.row.id === 'id-0')?.collectionKind,
		).toBeNull()
		expect(drafts.find(value => value.row.id === 'daily')?.assigned).toBe(
			true,
		)
		expect(query.is).toHaveBeenCalledWith('published_at', null)
		expect(query.in).toHaveBeenCalledWith('shape_id', [...PUZZLE_SHAPE_IDS])
		expect(range.mock.calls).toEqual([
			[0, 999],
			[1000, 1999],
		])
	})
	it('surfaces read and write errors and rejects unconfirmed mutations', async () => {
		const query = {
			in: vi.fn().mockReturnThis(),
			is: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			range: vi.fn().mockResolvedValue({
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
