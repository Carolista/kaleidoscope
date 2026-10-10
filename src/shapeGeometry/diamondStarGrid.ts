import type { Point } from '../types/geometry'
import type { DiamondStarCell } from '../types/diamondStar'
import { assignSymmetryGroups } from '@utils/symmetry'
import {
	DIAMOND_STAR_ROTATIONS,
	HALF_ANGLE_DEGREES,
	diamondCellCorners,
	diamondStarBoundingBox,
} from './diamondStarLayout'
import type { DiamondStarLayout } from './diamondStarLayout'

// Number of lattice rows/columns subdividing one diamond point ("how
// tall" each star petal is). Total clickable groups come out to
// `gridSize * (gridSize + 1) / 2` (see diamondStarGrid.test.ts for the
// derivation): the `gridSize` rhombi that sit exactly on a point's own
// mirror axis form smaller, size-6 orbits (rotation only, since they're
// already their own mirror image), while the rest form regular size-12
// orbits (6 rotations x mirror). gridSize=4 gives 10 clickable cells —
// deliberately fewer/larger than the hexagon/triangle grids' ~20-22, since
// these are chunkier rhombi rather than thin triangular slivers.
export const DIAMOND_STAR_GRID_SIZE = 4

const CENTER: Point = { x: 0, y: 0 }
// The star's own mirror axis, running straight up (-y) through each
// diamond point's own long axis.
const MIRROR_AXIS_ANGLE = -Math.PI / 2

// A fixed, abstract layout (edge length 1) used only to compute each
// small rhombus's centroid for the symmetry math below — unrelated to
// the actual on-screen render size, which DiamondStarGrid.tsx supplies.
function unitLayout(gridSize: number): DiamondStarLayout {
	return { gridSize, size: 1 }
}

interface RawCell {
	readonly row: number
	readonly col: number
}

// Every small rhombus within one diamond point, in row-major order —
// unlike the triangle grid's subdivision, there's no "direction"
// alternation here, since a rhombus tiles cleanly into smaller rhombi
// with no left-over triangular slivers.
function generateDiamondCells(gridSize: number): RawCell[] {
	const cells: RawCell[] = []
	for (let row = 0; row < gridSize; row++) {
		for (let col = 0; col < gridSize; col++) {
			cells.push({ row, col })
		}
	}
	return cells
}

function centroid(corners: readonly Point[]): Point {
	const sum = corners.reduce(
		(acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
		{ x: 0, y: 0 },
	)
	return { x: sum.x / corners.length, y: sum.y / corners.length }
}

// Picks the canonical (clickable) member of each symmetry orbit: the
// rhombi living in the "right half" of the star's "up" diamond point —
// the copy nearer its `sideRight` vertex — which spans exactly
// HALF_ANGLE_DEGREES, from straight up (270 degrees, the point's own
// mirror axis) to its outer edge (270 + HALF_ANGLE_DEGREES). A closed
// range (inclusive of both ends) reliably picks exactly one
// representative per orbit, including the point's own on-axis rhombi
// (row === col), which sit exactly at 270 degrees and are their own
// mirror image (see diamondStarGrid.test.ts).
function isCanonicalWedge(point: Point): boolean {
	let angle =
		Math.atan2(point.y - CENTER.y, point.x - CENTER.x) * (180 / Math.PI)
	if (angle < 0) angle += 360
	return angle >= 270 && angle <= 270 + HALF_ANGLE_DEGREES
}

// Generates every small rhombus in the kaleidoscope's 6-point diamond-
// star shape: one full diamond point (a rhombus) subdivided into a
// `gridSize x gridSize` lattice of smaller rhombi, replicated across the
// star's 6 rotational positions, each tagged with its symmetry-group id
// (grouped under the full D6 symmetry — 6 rotations + mirror — since 2
// rhombi within the same point can still mirror each other) and whether
// it's the clickable representative — the diamond-star counterpart of
// triangleGrid.ts's generateTriangleCells, reusing the same general
// symmetry engine with fold=6 instead of fold=3.
export function generateDiamondStarCells(
	gridSize: number = DIAMOND_STAR_GRID_SIZE,
): DiamondStarCell[] {
	const layout = unitLayout(gridSize)
	const baseCells = generateDiamondCells(gridSize)
	const baseCorners = baseCells.map(cell => diamondCellCorners(cell, layout))

	const raw: {
		row: number
		col: number
		transformIndex: number
		centroid: Point
	}[] = []
	DIAMOND_STAR_ROTATIONS.forEach((transform, transformIndex) => {
		baseCells.forEach((cell, cellIndex) => {
			const corners = baseCorners[cellIndex].map(transform)
			raw.push({ ...cell, transformIndex, centroid: centroid(corners) })
		})
	})

	const assignments = assignSymmetryGroups(
		raw.map(cell => cell.centroid),
		{
			center: CENTER,
			fold: 6,
			mirror: true,
			mirrorAxisAngle: MIRROR_AXIS_ANGLE,
		},
		isCanonicalWedge,
	)

	return raw.map((cell, index) => ({
		row: cell.row,
		col: cell.col,
		transformIndex: cell.transformIndex,
		groupId: assignments[index].groupId,
		isClickable: assignments[index].isClickable,
	}))
}

// Preserves insertion order (a plain `Map` does), since iteration order of
// the groups matters for the clickable wedge's visual sequence.
export function groupDiamondStarCells(
	cells: readonly DiamondStarCell[],
): Map<string, DiamondStarCell[]> {
	const groups = new Map<string, DiamondStarCell[]>()
	for (const cell of cells) {
		const list = groups.get(cell.groupId)
		if (list) {
			list.push(cell)
		} else {
			groups.set(cell.groupId, [cell])
		}
	}
	return groups
}

// Every distinct symmetry group id in the grid — lets callers (e.g. the
// design randomizer) know which groups exist without needing the full
// cell list.
export function getGroupIds(
	gridSize: number = DIAMOND_STAR_GRID_SIZE,
): string[] {
	return [...groupDiamondStarCells(generateDiamondStarCells(gridSize)).keys()]
}

// The grid's overall (width / height) ratio, independent of render size
// — a uniform scale factor cancels out of the ratio — so this reflects
// the same shape DiamondStarGrid renders (and the export service
// rasterizes from) without needing a live DOM/SVG element to measure.
export function computeGridAspectRatio(
	gridSize: number = DIAMOND_STAR_GRID_SIZE,
): number {
	const layout = unitLayout(gridSize)
	const baseCells = generateDiamondCells(gridSize)
	const baseCorners = baseCells.map(cell => diamondCellCorners(cell, layout))
	const corners = DIAMOND_STAR_ROTATIONS.flatMap(transform =>
		baseCorners.map(cellCorners => cellCorners.map(transform)),
	)
	const { minX, minY, maxX, maxY } = diamondStarBoundingBox(corners)
	return (maxX - minX) / (maxY - minY)
}
