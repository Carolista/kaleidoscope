import type { Point } from '../types/geometry'
import type { DiamondStarCell } from '../types/diamondStar'
import { rotate } from '@utils/symmetry'

export interface DiamondStarLayout {
	// Number of lattice rows/columns subdividing one diamond point, from
	// the star's center (row/col 0) out to its tip (row/col gridSize).
	readonly gridSize: number
	// Length of one lattice step, in SVG user units, so
	// `gridSize * size` is a full spoke's length (center to tip).
	readonly size: number
}

// Full angle, in degrees, at the center and at the tip of each diamond
// point. Narrower than a hexagon's 60-degree diamonds (two equilateral
// triangles joined base-to-base), for a "Lone Star" quilt-like look —
// but wide enough (vs. e.g. 30 degrees) that each small rhombus stays a
// comfortable touch target even at small screen sizes. Exported so
// diamondStarGrid.ts's canonical-wedge angle test can stay in sync
// without duplicating this constant.
export const POINT_ANGLE_DEGREES = 45
export const HALF_ANGLE_DEGREES = POINT_ANGLE_DEGREES / 2
const HALF_ANGLE = HALF_ANGLE_DEGREES * (Math.PI / 180)

const CENTER: Point = { x: 0, y: 0 }

// The 4 vertices of one full diamond point (a rhombus): `center` is the
// star's shared center; `tip` is the point's outer vertex; `sideRight`/
// `sideLeft` are the point's two wide (150-degree) side vertices,
// mirrored across the point's own long axis (which runs straight up,
// through `center` and `tip`) — matching the hexagon/triangle grids'
// convention of orienting the shape's "up" spoke near the top, close to
// the controls above the grid.
export function diamondVertices(layout: DiamondStarLayout): {
	readonly center: Point
	readonly sideRight: Point
	readonly sideLeft: Point
	readonly tip: Point
} {
	const length = layout.gridSize * layout.size
	const width = (length / 2) * Math.tan(HALF_ANGLE)
	return {
		center: CENTER,
		tip: { x: 0, y: -length },
		sideRight: { x: width, y: -length / 2 },
		sideLeft: { x: -width, y: -length / 2 },
	}
}

// A lattice point (row, col) within one diamond point, found by affine
// interpolation between the diamond's center and its 2 side vertices:
// `center + (row/N)(sideRight-center) + (col/N)(sideLeft-center)`. Since
// a rhombus is a parallelogram, this 2-axis lattice tiles it cleanly
// into `gridSize^2` smaller parallelograms with no left-over triangular
// slivers — and since `|sideRight-center|` equals `|sideLeft-center|` by
// construction (the diamond is symmetric about its own long axis), each
// step is the same length in both directions, so every small
// parallelogram this produces is itself a rhombus (see
// diamondStarLayout.test.ts).
function latticePoint(
	row: number,
	col: number,
	layout: DiamondStarLayout,
): Point {
	const { center, sideRight, sideLeft } = diamondVertices(layout)
	const rowT = row / layout.gridSize
	const colT = col / layout.gridSize
	return {
		x:
			center.x +
			rowT * (sideRight.x - center.x) +
			colT * (sideLeft.x - center.x),
		y:
			center.y +
			rowT * (sideRight.y - center.y) +
			colT * (sideLeft.y - center.y),
	}
}

// The 4 corner points of one small rhombus within a diamond point,
// before any symmetry transform is applied: the lattice square at
// (row, col)/(row+1, col+1), traced in order (an affine image of a unit
// square, so this is always a simple, convex quadrilateral).
export function diamondCellCorners(
	cell: Pick<DiamondStarCell, 'row' | 'col'>,
	layout: DiamondStarLayout,
): Point[] {
	const { row, col } = cell
	return [
		latticePoint(row, col, layout),
		latticePoint(row + 1, col, layout),
		latticePoint(row + 1, col + 1, layout),
		latticePoint(row, col + 1, layout),
	]
}

// The star's 6 rotational positions (its 6 diamond points). Unlike the
// triangle grid, no separate mirror step is needed here to *generate*
// the full star: each diamond point is already a complete rhombus
// (both halves of the mirror symmetry baked in by `diamondVertices`),
// so 6 rotations alone place all 6 points. (The *grouping* of clickable
// cells still uses the full D6 group — 6 rotations + mirror — via
// `assignSymmetryGroups` in diamondStarGrid.ts, since 2 rhombi within
// the same diamond point can still be mirror images of each other.)
export const DIAMOND_STAR_ROTATIONS: readonly ((point: Point) => Point)[] =
	Array.from(
		{ length: 6 },
		(_, k) => (point: Point) =>
			rotate(point, CENTER, (2 * Math.PI * k) / 6),
	)

// A cell's actual on-screen corner points: one diamond point's raw
// rhombus corners, moved into position by whichever of the star's 6
// rotations this cell represents.
export function diamondStarCellCorners(
	cell: DiamondStarCell,
	layout: DiamondStarLayout,
): Point[] {
	const raw = diamondCellCorners(cell, layout)
	const transform = DIAMOND_STAR_ROTATIONS[cell.transformIndex]
	return raw.map(transform)
}

// Computed directly from every cell's actual corner points, same
// approach as triangleLayout's `trianglesBoundingBox` (a diamond star's
// corners aren't equidistant from its center either).
export function diamondStarBoundingBox(
	corners: readonly (readonly Point[])[],
): { minX: number; minY: number; maxX: number; maxY: number } {
	let minX = Infinity
	let minY = Infinity
	let maxX = -Infinity
	let maxY = -Infinity
	for (const rhombus of corners) {
		for (const { x, y } of rhombus) {
			minX = Math.min(minX, x)
			minY = Math.min(minY, y)
			maxX = Math.max(maxX, x)
			maxY = Math.max(maxY, y)
		}
	}
	return { minX, minY, maxX, maxY }
}
