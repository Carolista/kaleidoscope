import { describe, expect, it } from 'vitest'
import type { Tables } from '@/lib/supabase'
import { PUZZLE_RECIPES } from './puzzle'
import { generateAuthoredPuzzle } from './puzzleAuthoring'
import { isPuzzleSolved, placePuzzlePiece } from './puzzle'
import { readPlayablePuzzle } from './readPlayablePuzzle'

const palette = {
	id: 'cabo',
	name: 'Cabo',
	colors: ['#a53f2b', '#f09f92', '#ffdccc', '#0f7173', '#124e5f'] as const,
}
const recipe = PUZZLE_RECIPES[3]

function stored(shape = 'hexagon' as const) {
	const authored = generateAuthoredPuzzle(
		'player-seed',
		palette.id,
		recipe,
		shape,
	)
	const row: Tables<'puzzles'> = {
		id: 'puzzle-1',
		name: 'Puzzle 1',
		shape_id: shape,
		board_size: recipe.size,
		difficulty: recipe.difficulty,
		rotation_allowed: recipe.rotation,
		palette_id: palette.id,
		definition: JSON.parse(JSON.stringify(authored.definition)),
		published_at: null,
		release_at: null,
	}
	return { authored, row }
}

describe('readPlayablePuzzle', () => {
	it('renders the stored definition in its palette without authoring data', () => {
		const { authored, row } = stored()
		const puzzle = readPlayablePuzzle(row, palette)
		expect(puzzle.shape).toBe('hexagon')
		expect(puzzle.paletteName).toBe('Cabo')
		expect(puzzle.rotationAllowed).toBe(true)
		expect(puzzle.seed).toBe('puzzle-1')
		expect(puzzle.solution).toEqual({})
		expect(Object.keys(puzzle.target)).toEqual(
			Object.keys(authored.definition.target),
		)
		expect(
			Object.values(puzzle.target).every(color =>
				palette.colors.includes(
					color as (typeof palette.colors)[number],
				),
			),
		).toBe(true)
	})

	it('is solvable by the authored solution', () => {
		const { authored, row } = stored()
		const puzzle = readPlayablePuzzle(row, palette)
		let placements = {}
		for (const piece of puzzle.pieces) {
			const result = placePuzzlePiece(
				puzzle,
				placements,
				piece.id,
				authored.knownSolution[piece.id],
			)
			expect(result.ok).toBe(true)
			if (result.ok) placements = result.placements
		}
		expect(isPuzzleSolved(puzzle, placements)).toBe(true)
	})

	it('rejects a different palette, an unsupported shape, and a broken definition', () => {
		const { row } = stored()
		expect(() =>
			readPlayablePuzzle(row, { ...palette, id: 'other' }),
		).toThrow('assigned palette')
		expect(() =>
			readPlayablePuzzle({ ...row, shape_id: 'blob' }, palette),
		).toThrow('unsupported shape or recipe')
		expect(() =>
			readPlayablePuzzle({ ...row, definition: { version: 1 } }, palette),
		).toThrow()
	})
})
