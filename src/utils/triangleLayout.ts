import type { Point } from '../types/geometry'
import type { TriangleCell } from '../types/triangle'

export interface TriangleLayout {
	// Length of one small triangle's edge, in SVG user units.
	readonly size: number
}

const SQRT3 = Math.sqrt(3)

// A lattice point (row, col): row counts down from the big triangle's
// apex (row 0), col is the point's position within that row (0..row).
// Lattice row `row` has `row + 1` points and sits `size * sqrt(3)/2`
// below row `row - 1`, so each small triangle formed between adjacent
// rows is equilateral with edge length `size`.
export function latticePoint(
	row: number,
	col: number,
	layout: TriangleLayout,
): Point {
	const { size } = layout
	return {
		x: size * (col - row / 2),
		y: size * row * (SQRT3 / 2),
	}
}

// The 3 corner points of one small triangle. An "up" triangle (pointing
// the same way as the overall big triangle) spans lattice rows
// row/row+1 starting at col; a "down" triangle (inverted) spans the same
// two rows but is the gap between two "up" triangles.
export function triangleCorners(
	cell: Pick<TriangleCell, 'row' | 'col' | 'direction'>,
	layout: TriangleLayout,
): Point[] {
	const { row, col, direction } = cell
	if (direction === 'up') {
		return [
			latticePoint(row, col, layout),
			latticePoint(row + 1, col, layout),
			latticePoint(row + 1, col + 1, layout),
		]
	}
	return [
		latticePoint(row, col, layout),
		latticePoint(row, col + 1, layout),
		latticePoint(row + 1, col + 1, layout),
	]
}

// Computed directly from every cell's actual corner points (rather than
// a center + fixed margin, as hexLayout's boundingBox does) since a
// triangle's corners aren't equidistant from its centroid.
export function trianglesBoundingBox(corners: readonly (readonly Point[])[]): {
	minX: number
	minY: number
	maxX: number
	maxY: number
} {
	let minX = Infinity
	let minY = Infinity
	let maxX = -Infinity
	let maxY = -Infinity
	for (const triangle of corners) {
		for (const { x, y } of triangle) {
			minX = Math.min(minX, x)
			minY = Math.min(minY, y)
			maxX = Math.max(maxX, x)
			maxY = Math.max(maxY, y)
		}
	}
	return { minX, minY, maxX, maxY }
}
