import type { Point } from '@/domain/geometry'
import type { AxialCoord } from '@/domain/shapes/hexagon'
import { unplaceableTiles } from './puzzle'
import type { Puzzle, PuzzlePlacements } from './puzzle'
import { puzzleShapes } from './puzzleShapes'

// How far beyond a tile's own area a free spot still pulls a held piece in, as
// a fraction of the spacing between tiles. Kept small, so a piece over another
// piece does not jump to a distant gap.
export const SNAP_REACH = 0.01

interface ScreenTransform {
	readonly a: number
	readonly b: number
	readonly c: number
	readonly d: number
	readonly e: number
	readonly f: number
}

// Inverts an SVG screen transform: a point on the screen to board units.
export function screenToBoard(
	transform: ScreenTransform,
	{ x, y }: Point,
): Point {
	const { a, b, c, d, e, f } = transform
	const determinant = a * d - b * c
	return {
		x: (d * (x - e) - c * (y - f)) / determinant,
		y: (a * (y - f) - b * (x - e)) / determinant,
	}
}

// The anchor of the nearest wedge tile, within reach of the pointer, where
// every tile of the held piece fits. The grabbed tile (`offset`) lands on that
// wedge tile. Null when nothing open is close enough, so the piece floats.
export function nearestOpenAnchor({
	puzzle,
	placements,
	pieceId,
	rotation,
	offset,
	pointer,
	size,
	reach = SNAP_REACH,
}: {
	readonly puzzle: Puzzle
	readonly placements: PuzzlePlacements
	readonly pieceId: string
	readonly rotation: number
	// The grabbed tile's offset in the displayed (already rotated) piece.
	readonly offset: AxialCoord
	// Pointer position in board units.
	readonly pointer: Point
	// Board units per tile, as the board draws them.
	readonly size: number
	readonly reach?: number
}): AxialCoord | null {
	const shape = puzzleShapes[puzzle.shape]
	const wedge = shape
		.cells(puzzle.gridSize)
		.filter(cell => cell.isClickable)
		.map(cell => ({ cell, center: shape.center(cell, size) }))
	let spacing = Infinity
	for (const [i, first] of wedge.entries()) {
		for (const second of wedge.slice(i + 1)) {
			spacing = Math.min(
				spacing,
				Math.hypot(
					first.center.x - second.center.x,
					first.center.y - second.center.y,
				),
			)
		}
	}
	const limit = spacing / 2 + reach * spacing
	const candidates = wedge
		.map(({ cell, center }) => ({
			cell,
			distance: Math.hypot(center.x - pointer.x, center.y - pointer.y),
		}))
		.filter(({ distance }) => distance <= limit)
		.sort((a, b) => a.distance - b.distance)
	for (const { cell } of candidates) {
		const anchor = { q: cell.q - offset.q, r: cell.r - offset.r }
		if (shape.isAnchor && !shape.isAnchor(anchor)) continue
		if (
			unplaceableTiles(puzzle, placements, pieceId, {
				...anchor,
				...(rotation ? { rotation } : {}),
			}).size === 0
		)
			return anchor
	}
	return null
}
