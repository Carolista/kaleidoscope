import type { Point } from '../types/geometry'
import type { TriangleCell } from '../types/triangle'
import { averagePoint } from '@utils/geometryMath'
import { groupCells } from '@utils/groupCells'
import { assignSymmetryGroups } from '@utils/symmetry'
import { triangleCorners, trianglesBoundingBox } from './triangleLayout'
import type { TriangleLayout } from './triangleLayout'

// Number of lattice rows the big triangle is subdivided into. Chosen to
// give a similar number of clickable tiles (~20) to the hexagon grid's
// default radius, for comparable painting granularity.
export const TRIANGLE_GRID_SIZE = 10

const SQRT3 = Math.sqrt(3)
// A fixed, abstract layout (edge length 1) used only to compute each
// small triangle's centroid for the symmetry math below — unrelated to
// the actual on-screen render size, which TriangleGrid.tsx supplies.
const UNIT_LAYOUT: TriangleLayout = { size: 1 }

interface RawTriangle {
	readonly row: number
	readonly col: number
	readonly direction: 'up' | 'down'
	readonly centroid: Point
}

// Every small triangle in the big triangle's subdivision, in row-major
// order: row `row` alternates `row + 1` "up" triangles with `row` "down"
// triangles in between them, for `gridSize` rows total (`gridSize^2`
// small triangles overall).
function generateRawTriangles(gridSize: number): RawTriangle[] {
	const triangles: RawTriangle[] = []
	for (let row = 0; row < gridSize; row++) {
		for (let col = 0; col <= row; col++) {
			const corners = triangleCorners(
				{ row, col, direction: 'up' },
				UNIT_LAYOUT,
			)
			triangles.push({
				row,
				col,
				direction: 'up',
				centroid: averagePoint(corners),
			})
		}
		for (let col = 0; col < row; col++) {
			const corners = triangleCorners(
				{ row, col, direction: 'down' },
				UNIT_LAYOUT,
			)
			triangles.push({
				row,
				col,
				direction: 'down',
				centroid: averagePoint(corners),
			})
		}
	}
	return triangles
}

// The big triangle's own centroid (average of its 3 outer vertices),
// used as the symmetry group's center of rotation/reflection.
function gridCenter(gridSize: number): Point {
	return { x: 0, y: (gridSize * SQRT3) / 3 }
}

// Picks the canonical (clickable) member of each mirror-symmetry orbit:
// the one in the 60-degree wedge just to the right of straight up (the
// big triangle's apex), matching the hexagon grid's convention of landing
// the clickable wedge near 11-12 o'clock, close to the controls above
// the grid. A closed [270, 330] range on the angle from center reliably
// picks exactly one representative per orbit, including the degenerate
// orbits that sit exactly on a mirror axis (see symmetry.test.ts).
function isCanonicalWedge(point: Point, center: Point): boolean {
	let angle =
		Math.atan2(point.y - center.y, point.x - center.x) * (180 / Math.PI)
	if (angle < 0) angle += 360
	return angle >= 270 && angle <= 330
}

// Generates every small triangle in the kaleidoscope's triangle-grid
// shape: a big equilateral triangle subdivided into `gridSize^2` small
// triangles, each tagged with its mirror-symmetry group id and whether
// it's the clickable representative for that group — the triangle-grid
// counterpart of hexagonGrid.ts's generateHexagonCells, but using the
// general symmetry engine (symmetry.ts) instead of hexagon-specific
// coordinate algebra, since a triangular lattice doesn't have the same
// simple cube-coordinate rotation trick hexagons do.
export function generateTriangleCells(
	gridSize: number = TRIANGLE_GRID_SIZE,
): TriangleCell[] {
	const raw = generateRawTriangles(gridSize)
	const center = gridCenter(gridSize)
	const assignments = assignSymmetryGroups(
		raw.map(t => t.centroid),
		{ center, fold: 3, mirror: true, mirrorAxisAngle: Math.PI / 2 },
		point => isCanonicalWedge(point, center),
	)

	return raw.map((triangle, index) => ({
		row: triangle.row,
		col: triangle.col,
		direction: triangle.direction,
		groupId: assignments[index].groupId,
		isClickable: assignments[index].isClickable,
	}))
}

// Preserves insertion order (a plain `Map` does), since iteration order of
// the groups matters for the clickable wedge's visual sequence.
export function groupTriangleCells(
	cells: readonly TriangleCell[],
): Map<string, TriangleCell[]> {
	return groupCells(cells)
}

// Every distinct mirror-symmetry group id in the grid — lets callers
// (e.g. the design randomizer) know which groups exist without needing
// the full cell list.
export function getGroupIds(gridSize: number = TRIANGLE_GRID_SIZE): string[] {
	return [...groupTriangleCells(generateTriangleCells(gridSize)).keys()]
}

// The grid's overall (width / height) ratio, independent of render size
// — a uniform scale factor cancels out of the ratio — so this reflects
// the same shape TriangleGrid renders (and the export service
// rasterizes from) without needing a live DOM/SVG element to measure.
export function computeGridAspectRatio(
	gridSize: number = TRIANGLE_GRID_SIZE,
): number {
	const corners = generateRawTriangles(gridSize).map(cell =>
		triangleCorners(cell, UNIT_LAYOUT),
	)
	const { minX, minY, maxX, maxY } = trianglesBoundingBox(corners)
	return (maxX - minX) / (maxY - minY)
}
