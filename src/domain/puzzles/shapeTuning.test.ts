import { describe, expect, it } from 'vitest'
import { generatePuzzle } from './puzzle'
import {
	pinwheelGridSize,
	pinwheelSteps,
	puzzleShapes,
	PUZZLE_SHAPE_IDS,
} from './puzzleShapes'
import {
	checkGridSize,
	checkPieceMix,
	checkPinwheelSteps,
	MAX_TUNED_WEDGE_CELLS,
	parsePieceMix,
	shippedTuning,
	wedgeCellCount,
} from './shapeTuning'

const palette = {
	name: 'Test',
	colors: ['#111111', '#222222', '#333333', '#444444', '#555555'],
} as const

describe('shape tuning', () => {
	it('counts wedge cells for every shape, and nothing for grids that do not exist', () => {
		expect(wedgeCellCount('hexagon', 4)).toBe(9)
		expect(wedgeCellCount('triangle', 7)).toBe(12)
		expect(wedgeCellCount('pinwheel', 32)).toBe(6)
		expect(wedgeCellCount('pinwheel', 7)).toBeNull()
		expect(wedgeCellCount('hexagon', 0)).toBeNull()
		expect(wedgeCellCount('hexagon', 2.5)).toBeNull()
	})

	it('accepts every shipped grid size and piece mix', () => {
		for (const id of PUZZLE_SHAPE_IDS) {
			const { gridSizes, pieceSizes } = shippedTuning(id)
			for (const size of ['sm', 'md', 'lg'] as const) {
				expect(checkGridSize(id, gridSizes[size])).toBeNull()
				expect(
					checkPieceMix(id, gridSizes[size], pieceSizes[size]),
				).toBeNull()
			}
		}
	})

	it('explains why a grid size or piece mix is not usable', () => {
		expect(checkGridSize('hexagon', 0)).toBe(
			'Enter a whole number of 1 or more.',
		)
		expect(checkGridSize('pinwheel', 7)).toBe(
			'This shape has no grid with n = 7.',
		)
		expect(checkGridSize('hexagon', 10)).toMatch(
			new RegExp(`up to ${MAX_TUNED_WEDGE_CELLS}`),
		)
		expect(checkPieceMix('hexagon', 3, [3, 2])).toBe(
			'The pieces add up to 5, but the wedge has 6 cells.',
		)
		expect(checkPieceMix('hexagon', 3, [])).toBe('Add at least one piece.')
		expect(checkPieceMix('hexagon', 3, [7, -1])).toMatch(/1 to 6 tiles/)
		expect(checkPieceMix('hexagon', 3, null)).toMatch(/whole numbers/)
	})

	it('reads piece mixes typed with commas, plus signs, or spaces', () => {
		expect(parsePieceMix('3, 2, 1')).toEqual([3, 2, 1])
		expect(parsePieceMix('3+2+1')).toEqual([3, 2, 1])
		expect(parsePieceMix('3 2 1')).toEqual([3, 2, 1])
		expect(parsePieceMix('')).toEqual([])
		expect(parsePieceMix('3, x')).toBeNull()
		expect(parsePieceMix('3.5')).toBeNull()
	})
})

describe('generating with tuning', () => {
	it('matches the shipped puzzle when nothing is overridden', () => {
		for (const id of PUZZLE_SHAPE_IDS) {
			const recipe = { size: 'md', rotation: false } as const
			const { gridSizes, pieceSizes } = shippedTuning(id)
			expect(
				generatePuzzle('seed', palette, recipe, id, {
					gridSize: gridSizes.md,
					pieceSizes: pieceSizes.md,
				}),
			).toEqual(generatePuzzle('seed', palette, recipe, id))
		}
	})

	it('builds a puzzle on the tried-out grid size and piece mix', () => {
		const puzzle = generatePuzzle(
			'seed',
			palette,
			{ size: 'sm', rotation: false },
			'hexagon',
			{ gridSize: 4, pieceSizes: [4, 3, 2] },
		)
		expect(puzzle.gridSize).toBe(4)
		expect(puzzle.pieces.map(piece => piece.tiles.length).sort()).toEqual([
			2, 3, 4,
		])
	})

	it('gives up on a mix it cannot arrange instead of searching forever', () => {
		expect(() =>
			generatePuzzle(
				'seed',
				palette,
				{ size: 'sm', rotation: false },
				'hexagon',
				{ gridSize: 3, pieceSizes: [2, 2, 2], attemptLimit: 0 },
			),
		).toThrow(/quickly/)
	})

	it('builds pinwheels of any rows x columns, told apart by rows * 10 + columns', () => {
		expect(pinwheelSteps(32)).toEqual({ rowSteps: 3, colSteps: 2 })
		expect(pinwheelSteps(pinwheelGridSize(4, 2))).toEqual({
			rowSteps: 4,
			colSteps: 2,
		})
		expect(wedgeCellCount('pinwheel', pinwheelGridSize(4, 2))).toBe(8)
		// A wider grid is not the same shape as a taller one.
		expect(puzzleShapes.pinwheel.cells(pinwheelGridSize(2, 4))).not.toEqual(
			puzzleShapes.pinwheel.cells(pinwheelGridSize(4, 2)),
		)
		expect(() => puzzleShapes.pinwheel.cells(7)).toThrow(/Unsupported/)
		expect(() => puzzleShapes.pinwheel.cells(20)).toThrow(/Unsupported/)
		const puzzle = generatePuzzle(
			'seed',
			palette,
			{ size: 'sm', rotation: false },
			'pinwheel',
			{ gridSize: pinwheelGridSize(4, 2), pieceSizes: [4, 4] },
		)
		expect(puzzle.gridSize).toBe(42)
	})

	it('limits pinwheel steps to 1 through 9 each way', () => {
		expect(checkPinwheelSteps(2, 9)).toBeNull()
		for (const [rows, cols] of [
			[0, 2],
			[2, 10],
			[2.5, 2],
		])
			expect(checkPinwheelSteps(rows, cols)).toBe(
				'Use 1 to 9 steps each way.',
			)
	})
})
