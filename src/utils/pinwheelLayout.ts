import type { Point } from '../types/geometry'
import type { PinwheelCell } from '../types/pinwheel'
import { rotate } from './symmetry'

export interface PinwheelLayout {
	// Number of lattice steps from the center to the spoke's `sideRight`
	// vertex.
	readonly rowSteps: number
	// Number of lattice steps from the center to the spoke's `sideLeft`
	// vertex. Deliberately independent of `rowSteps` (see
	// `spokeCellCorners` below) — unlike the diamond star's single shared
	// `gridSize`, this mismatch is what makes the subdivision lopsided.
	readonly colSteps: number
	// Reference lattice-step length, in SVG user units — every lattice
	// step along the row axis is exactly this long; col-axis steps are
	// `PINWHEEL_COL_ASPECT_RATIO` times longer (see `sideLengths`), so
	// `size` stays a comparable "typical cell size" to the other shapes'
	// sizing props regardless of how lopsided rowSteps/colSteps are.
	readonly size: number
}

export const PINWHEEL_FOLD = 8
// Each spoke spans exactly one `PINWHEEL_FOLD`th of the full circle, so
// adjacent rotated copies share the same angular range with no gap or
// overlap in angle — though since `sideRight`/`sideLeft` aren't
// necessarily the same distance from the center (see `sideLengths`),
// there can still be small radial gaps between a spoke's outer edges
// and its neighbors' (unlike the diamond star's much wider, deliberate
// background gaps between narrow 45-degree points spaced 60 degrees
// apart).
export const FULL_ANGLE_DEGREES = 360 / PINWHEEL_FOLD
// How much longer a `colSteps` lattice step is than a `rowSteps` step
// (both measured in the same `size` units) — makes each small cell an
// elongated parallelogram rather than a square/rhombus, which visually
// separates adjacent spokes from each other instead of reading as one
// solid star.
export const PINWHEEL_COL_ASPECT_RATIO = 2
const HALF_ANGLE = (FULL_ANGLE_DEGREES / 2) * (Math.PI / 180)
// Straight up (negative y), matching every other shape's convention of
// orienting one copy near the top, close to the controls above the grid.
const UP_ANGLE = -Math.PI / 2

const CENTER: Point = { x: 0, y: 0 }

// `size` scaled by each axis's own step count: `sideRight` is
// `rowSteps` lattice steps from the center, each `size` long;
// `sideLeft` is `colSteps` steps, each `PINWHEEL_COL_ASPECT_RATIO *
// size` long (an elongated step, not a square one) — so individual
// cells are stretched parallelograms rather than rhombi, and
// `sideRight`/`sideLeft` are unequal distances from the center whenever
// rowSteps/colSteps/the aspect ratio don't happen to cancel out. This
// trades seamless edge-to-edge tiling (visible gaps between spokes) for
// a spoke silhouette that doesn't balloon out into a sharp star point —
// see `spokeVertices`.
function sideLengths(layout: PinwheelLayout): {
	readonly right: number
	readonly left: number
} {
	return {
		right: layout.size * layout.rowSteps,
		left: layout.size * PINWHEEL_COL_ASPECT_RATIO * layout.colSteps,
	}
}

// The 4 vertices of one full spoke (a parallelogram): `center` is the
// pinwheel's shared center; `tip` is the spoke's outer vertex;
// `sideRight`/`sideLeft` are its other two vertices, at +/- half the
// spoke's angular span from straight up, each at its own axis's length
// (see `sideLengths`). `tip` is still their vector sum minus `center`
// (the parallelogram still closes), but since `sideRight`/`sideLeft`
// are deliberately unequal distances from the center, this is a general
// parallelogram rather than a rhombus, so the tip no longer sits
// symmetrically on the spoke's own bisector.
export function spokeVertices(layout: PinwheelLayout): {
	readonly center: Point
	readonly sideRight: Point
	readonly sideLeft: Point
	readonly tip: Point
} {
	const { right, left } = sideLengths(layout)
	const sideRight = {
		x: right * Math.cos(UP_ANGLE + HALF_ANGLE),
		y: right * Math.sin(UP_ANGLE + HALF_ANGLE),
	}
	const sideLeft = {
		x: left * Math.cos(UP_ANGLE - HALF_ANGLE),
		y: left * Math.sin(UP_ANGLE - HALF_ANGLE),
	}
	return {
		center: CENTER,
		sideRight,
		sideLeft,
		tip: {
			x: sideRight.x + sideLeft.x - CENTER.x,
			y: sideRight.y + sideLeft.y - CENTER.y,
		},
	}
}

// A lattice point (row, col) within one spoke, found by affine
// interpolation between the spoke's center and its 2 side vertices —
// the same formula as diamondStarLayout's `latticePoint`, but `row`/
// `col` are fractions of *independent* step counts (`rowSteps`/
// `colSteps`), and `sideRight`/`sideLeft` are deliberately unequal
// distances from the center (see `sideLengths` above). That's what
// makes each small cell a uniform elongated parallelogram (not a
// rhombus or a square) and breaks the spoke's own mirror symmetry,
// rather than relying on mismatched row/col step counts (see
// pinwheelLayout.test.ts).
function latticePoint(row: number, col: number, layout: PinwheelLayout): Point {
	const { center, sideRight, sideLeft } = spokeVertices(layout)
	const rowT = row / layout.rowSteps
	const colT = col / layout.colSteps
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

// The 4 corner points of one small parallelogram within a spoke, before
// any symmetry transform is applied: the lattice square at
// (row, col)/(row+1, col+1), traced in order.
export function spokeCellCorners(
	cell: Pick<PinwheelCell, 'row' | 'col'>,
	layout: PinwheelLayout,
): Point[] {
	const { row, col } = cell
	return [
		latticePoint(row, col, layout),
		latticePoint(row + 1, col, layout),
		latticePoint(row + 1, col + 1, layout),
		latticePoint(row, col + 1, layout),
	]
}

// The pinwheel's 8 rotational positions (its 8 spokes). Unlike the
// diamond star, there's no mirror step at any point — a pinwheel is
// deliberately chiral (its own asymmetric lattice can't be its own
// mirror image), so only rotation ever replicates or groups its cells.
export const PINWHEEL_ROTATIONS: readonly ((point: Point) => Point)[] =
	Array.from(
		{ length: PINWHEEL_FOLD },
		(_, k) => (point: Point) =>
			rotate(point, CENTER, (2 * Math.PI * k) / PINWHEEL_FOLD),
	)

// A cell's actual on-screen corner points: one spoke's raw parallelogram
// corners, moved into position by whichever of the pinwheel's 8
// rotations this cell represents.
export function pinwheelCellCorners(
	cell: PinwheelCell,
	layout: PinwheelLayout,
): Point[] {
	const raw = spokeCellCorners(cell, layout)
	const transform = PINWHEEL_ROTATIONS[cell.transformIndex]
	return raw.map(transform)
}

// Computed directly from every cell's actual corner points, same
// approach as diamondStarLayout's `diamondStarBoundingBox`.
export function pinwheelBoundingBox(corners: readonly (readonly Point[])[]): {
	minX: number
	minY: number
	maxX: number
	maxY: number
} {
	let minX = Infinity
	let minY = Infinity
	let maxX = -Infinity
	let maxY = -Infinity
	for (const piece of corners) {
		for (const { x, y } of piece) {
			minX = Math.min(minX, x)
			minY = Math.min(minY, y)
			maxX = Math.max(maxX, x)
			maxY = Math.max(maxY, y)
		}
	}
	return { minX, minY, maxX, maxY }
}
