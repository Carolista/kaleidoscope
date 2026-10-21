import type { GridSize } from '@/domain/shapes'
import { puzzleShapes, type PuzzleShapeId } from './puzzleShapes'

// Generating a puzzle searches for connected pieces, so tried-out grids stay small.
export const MAX_TUNED_WEDGE_CELLS = 30
export const MAX_TUNED_PIECE_SIZE = 6
export const TUNING_ATTEMPT_LIMIT = 20000

// Cells in the wedge a puzzle's pieces must fill, or null if the shape has no such grid.
export function wedgeCellCount(
	shape: PuzzleShapeId,
	gridSize: number,
): number | null {
	if (!Number.isInteger(gridSize) || gridSize < 1) return null
	try {
		const count = puzzleShapes[shape]
			.cells(gridSize)
			.filter(cell => cell.isClickable).length
		return count > 0 ? count : null
	} catch {
		return null
	}
}

export function checkPinwheelSteps(
	rowSteps: number,
	colSteps: number,
): string | null {
	return [rowSteps, colSteps].every(
		steps => Number.isInteger(steps) && steps >= 1 && steps <= 9,
	)
		? null
		: 'Use 1 to 9 steps each way.'
}

export function checkGridSize(
	shape: PuzzleShapeId,
	gridSize: number,
): string | null {
	if (!Number.isInteger(gridSize) || gridSize < 1)
		return 'Enter a whole number of 1 or more.'
	const count = wedgeCellCount(shape, gridSize)
	if (count === null) return `This shape has no grid with n = ${gridSize}.`
	if (count > MAX_TUNED_WEDGE_CELLS)
		return `That grid has ${count} wedge cells; the tool handles up to ${MAX_TUNED_WEDGE_CELLS}.`
	return null
}

export function parsePieceMix(text: string): number[] | null {
	const parts = text.split(/[\s,+]+/).filter(Boolean)
	if (!parts.length) return []
	const sizes = parts.map(Number)
	return sizes.every(size => Number.isInteger(size)) ? sizes : null
}

export function checkPieceMix(
	shape: PuzzleShapeId,
	gridSize: number,
	sizes: readonly number[] | null,
): string | null {
	if (sizes === null) return 'Use whole numbers separated by commas.'
	if (!sizes.length) return 'Add at least one piece.'
	if (sizes.some(size => size < 1 || size > MAX_TUNED_PIECE_SIZE))
		return `Each piece needs 1 to ${MAX_TUNED_PIECE_SIZE} tiles.`
	const count = wedgeCellCount(shape, gridSize)
	if (count === null) return null
	const total = sizes.reduce((sum, size) => sum + size, 0)
	return total === count
		? null
		: `The pieces add up to ${total}, but the wedge has ${count} cells.`
}

// The values the shape ships with: n per size, and the piece mix per size.
export function shippedTuning(shape: PuzzleShapeId) {
	const { gridSizes, pieceSizes } = puzzleShapes[shape]
	return { gridSizes, pieceSizes } satisfies {
		gridSizes: Readonly<Record<GridSize, number>>
		pieceSizes: Readonly<Record<GridSize, readonly number[]>>
	}
}
