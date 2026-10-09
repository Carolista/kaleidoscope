import type { Point } from '../types/geometry'
import type { HexagramCell } from '../types/hexagram'
import { assignSymmetryGroups } from './symmetry'
import {
	HEXAGRAM_ROTATIONS,
	hexagramBoundingBox,
	hexagramCellCorners,
} from './hexagramLayout'
import type { HexagramLayout } from './hexagramLayout'

// Number of lattice rows subdividing each of a spoke's 2 equilateral
// triangles. Total clickable groups come out to `gridSize * (gridSize +
// 1)` (see hexagramGrid.test.ts for the derivation): `2 * gridSize` of
// them sit exactly on a spoke's own mirror axis, forming smaller, size-6
// orbits (rotation only, since they're already their own mirror image),
// while the rest form regular size-12 orbits (6 rotations x mirror).
// gridSize=4 gives 20 clickable cells, comparable density to the hex and
// triangle grids.
export const HEXAGRAM_GRID_SIZE = 4

const CENTER: Point = { x: 0, y: 0 }
// The shape's own mirror axis, running straight up (-y) through each
// spoke's own long axis.
const MIRROR_AXIS_ANGLE = -Math.PI / 2

// A fixed, abstract layout (edge length 1) used only to compute each
// small triangle's centroid for the symmetry math below — unrelated to
// the actual on-screen render size, which HexagramGrid.tsx supplies.
function unitLayout(gridSize: number): HexagramLayout {
	return { gridSize, size: 1 }
}

interface RawCell {
	readonly piece: 'hexSector' | 'point'
	readonly row: number
	readonly col: number
	readonly direction: 'up' | 'down'
}

// Every small triangle within one spoke's `hexSector` or `point` piece,
// in row-major order — same up/down alternation as triangleGrid.ts's
// `generateRawTriangles`, just applied twice (once per piece) since a
// spoke is 2 separate equilateral triangles, not 1.
function generatePieceCells(
	piece: 'hexSector' | 'point',
	gridSize: number,
): RawCell[] {
	const cells: RawCell[] = []
	for (let row = 0; row < gridSize; row++) {
		for (let col = 0; col <= row; col++) {
			cells.push({ piece, row, col, direction: 'up' })
		}
		for (let col = 0; col < row; col++) {
			cells.push({ piece, row, col, direction: 'down' })
		}
	}
	return cells
}

function generateSpokeCells(gridSize: number): RawCell[] {
	return [
		...generatePieceCells('hexSector', gridSize),
		...generatePieceCells('point', gridSize),
	]
}

function centroid(corners: readonly Point[]): Point {
	return {
		x: (corners[0].x + corners[1].x + corners[2].x) / 3,
		y: (corners[0].y + corners[1].y + corners[2].y) / 3,
	}
}

// Picks the canonical (clickable) member of each symmetry orbit: the
// triangles living in the "right half" of the star's "up" spoke — the
// half nearer its `hexEdgeRight` vertex — which spans exactly 30 degrees,
// from straight up (270 degrees, the spoke's own mirror axis) to its
// outer edge (300 degrees, matching a 60-degree spoke split in half). A
// closed [270, 300] range (inclusive of both ends) reliably picks exactly
// one representative per orbit, including the spoke's own on-axis
// triangles (row === col within a piece), which sit exactly at 270
// degrees and are their own mirror image (see hexagramGrid.test.ts).
function isCanonicalWedge(point: Point): boolean {
	let angle =
		Math.atan2(point.y - CENTER.y, point.x - CENTER.x) * (180 / Math.PI)
	if (angle < 0) angle += 360
	return angle >= 270 && angle <= 300
}

// Generates every small triangle in the kaleidoscope's hexagram shape: a
// central hexagon with an equilateral-triangle point attached to each of
// its 6 edges, each "spoke" (one hexagon slice + its point, together
// forming a 60/120-degree rhombus) subdivided into `2 * gridSize^2` small
// equilateral triangles and replicated across the shape's 6 rotational
// positions, each tagged with its symmetry-group id (grouped under the
// full D6 symmetry — 6 rotations + mirror — since 2 triangles within the
// same spoke can still mirror each other) and whether it's the clickable
// representative — the hexagram counterpart of diamondStarGrid.ts's
// generateDiamondStarCells, reusing the same general symmetry engine.
export function generateHexagramCells(
	gridSize: number = HEXAGRAM_GRID_SIZE,
): HexagramCell[] {
	const layout = unitLayout(gridSize)
	const baseCells = generateSpokeCells(gridSize)
	const baseCorners = baseCells.map(cell => hexagramCellCorners(cell, layout))

	const raw: {
		piece: 'hexSector' | 'point'
		row: number
		col: number
		direction: 'up' | 'down'
		transformIndex: number
		centroid: Point
	}[] = []
	HEXAGRAM_ROTATIONS.forEach((transform, transformIndex) => {
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
		piece: cell.piece,
		row: cell.row,
		col: cell.col,
		direction: cell.direction,
		transformIndex: cell.transformIndex,
		groupId: assignments[index].groupId,
		isClickable: assignments[index].isClickable,
	}))
}

// Preserves insertion order (a plain `Map` does), since iteration order of
// the groups matters for the clickable wedge's visual sequence.
export function groupHexagramCells(
	cells: readonly HexagramCell[],
): Map<string, HexagramCell[]> {
	const groups = new Map<string, HexagramCell[]>()
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
export function getGroupIds(gridSize: number = HEXAGRAM_GRID_SIZE): string[] {
	return [...groupHexagramCells(generateHexagramCells(gridSize)).keys()]
}

// The grid's overall (width / height) ratio, independent of render size
// — a uniform scale factor cancels out of the ratio — so this reflects
// the same shape HexagramGrid renders (and the export service
// rasterizes from) without needing a live DOM/SVG element to measure.
export function computeGridAspectRatio(
	gridSize: number = HEXAGRAM_GRID_SIZE,
): number {
	const layout = unitLayout(gridSize)
	const baseCells = generateSpokeCells(gridSize)
	const baseCorners = baseCells.map(cell => hexagramCellCorners(cell, layout))
	const corners = HEXAGRAM_ROTATIONS.flatMap(transform =>
		baseCorners.map(cellCorners => cellCorners.map(transform)),
	)
	const { minX, minY, maxX, maxY } = hexagramBoundingBox(corners)
	return (maxX - minX) / (maxY - minY)
}
