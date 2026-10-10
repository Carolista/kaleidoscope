import type { Point } from '../types/geometry'
import type { HexagramCell } from '../types/hexagram'
import { rotate } from '@utils/symmetry'

export interface HexagramLayout {
	// Number of lattice rows subdividing each of the 2 equilateral
	// triangles (the hexagon slice and its attached point) making up one
	// 60-degree spoke.
	readonly gridSize: number
	// Length of one small triangle's edge, in SVG user units.
	readonly size: number
}

const CENTER: Point = { x: 0, y: 0 }
const SQRT3 = Math.sqrt(3)

// The 4 vertices shared by one spoke's 2 equilateral triangles: `center`
// is the star's shared center (also the hexagon-slice's apex); `tip` is
// the point's outer vertex; `hexEdgeRight`/`hexEdgeLeft` are the 2
// vertices of the hexagon edge the point sits on, mirrored across the
// spoke's own long axis (which runs straight up, through `center` and
// `tip`) — matching the hex/triangle/diamond-star grids' convention of
// orienting the shape's "up" spoke near the top, close to the controls
// above the grid. Unlike the diamond star's point, these 2 triangles are
// each genuinely equilateral (all 60-degree angles), since that's the
// whole point of this shape.
export function hexagramVertices(layout: HexagramLayout): {
	readonly center: Point
	readonly hexEdgeRight: Point
	readonly hexEdgeLeft: Point
	readonly tip: Point
} {
	const edgeLength = layout.gridSize * layout.size
	const apothem = (edgeLength * SQRT3) / 2
	return {
		center: CENTER,
		hexEdgeRight: { x: edgeLength / 2, y: -apothem },
		hexEdgeLeft: { x: -edgeLength / 2, y: -apothem },
		tip: { x: 0, y: -2 * apothem },
	}
}

// A lattice point (row, col) within one of the spoke's 2 triangles, found
// by affine interpolation between its 3 vertices: `apex + (row/N)(baseA -
// apex) + (col/N)(baseB - baseA)`. This is the same general-triangle
// formula diamondStarLayout.ts used for its (non-equilateral) wedge; here
// `apex`/`baseA`/`baseB` always form an actual equilateral triangle, so
// this reduces to (and could equivalently be computed via)
// triangleLayout.ts's specialized formula — but since one spoke needs 2
// differently-oriented equilateral triangles (the hexagon slice pointing
// "in", the point pointing "out"), it's simplest to share one general
// helper for both rather than reorienting triangleLayout's fixed layout
// twice.
function latticePoint(
	row: number,
	col: number,
	layout: HexagramLayout,
	apex: Point,
	baseA: Point,
	baseB: Point,
): Point {
	const rowT = row / layout.gridSize
	const colT = col / layout.gridSize
	return {
		x: apex.x + rowT * (baseA.x - apex.x) + colT * (baseB.x - baseA.x),
		y: apex.y + rowT * (baseA.y - apex.y) + colT * (baseB.y - baseA.y),
	}
}

// The 3 corner points of one small triangle within a spoke's `hexSector`
// or `point` piece, before any symmetry transform is applied — same
// up/down convention as triangleLayout's `triangleCorners`.
export function hexagramCellCorners(
	cell: Pick<HexagramCell, 'piece' | 'row' | 'col' | 'direction'>,
	layout: HexagramLayout,
): Point[] {
	const { center, hexEdgeRight, hexEdgeLeft, tip } = hexagramVertices(layout)
	const [apex, baseA, baseB] =
		cell.piece === 'hexSector'
			? [center, hexEdgeLeft, hexEdgeRight]
			: [tip, hexEdgeRight, hexEdgeLeft]
	const { row, col, direction } = cell
	const at = (r: number, c: number) =>
		latticePoint(r, c, layout, apex, baseA, baseB)
	if (direction === 'up') {
		return [at(row, col), at(row + 1, col), at(row + 1, col + 1)]
	}
	return [at(row, col), at(row, col + 1), at(row + 1, col + 1)]
}

// The shape's 6 rotational positions (its 6 spokes). As with the diamond
// star, no separate mirror step is needed to *generate* the full shape:
// each spoke (hexSector + point, forming a 60/120-degree rhombus) is
// already symmetric about its own long axis, so 6 rotations alone place
// all 6 spokes. (The *grouping* of clickable cells still uses the full D6
// group — 6 rotations + mirror — via `assignSymmetryGroups` in
// hexagramGrid.ts, since 2 triangles within the same spoke can still be
// mirror images of each other.)
export const HEXAGRAM_ROTATIONS: readonly ((point: Point) => Point)[] =
	Array.from(
		{ length: 6 },
		(_, k) => (point: Point) =>
			rotate(point, CENTER, (2 * Math.PI * k) / 6),
	)

// A cell's actual on-screen corner points: the fundamental spoke's
// triangle corners, moved into position by whichever of the shape's 6
// rotations this cell represents.
export function hexagramStarCellCorners(
	cell: HexagramCell,
	layout: HexagramLayout,
): Point[] {
	const raw = hexagramCellCorners(cell, layout)
	const transform = HEXAGRAM_ROTATIONS[cell.transformIndex]
	return raw.map(transform)
}

// Computed directly from every cell's actual corner points, same
// approach as triangleLayout's `trianglesBoundingBox` (this shape's
// corners aren't equidistant from its center either).
export function hexagramBoundingBox(corners: readonly (readonly Point[])[]): {
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
