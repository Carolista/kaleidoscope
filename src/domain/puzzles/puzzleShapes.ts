import type { Point } from '@/domain/geometry'
import type { GridSize } from '@/domain/shapes'
import type { AxialCoord } from '@/domain/shapes/hexagon'
import {
	axialToPixel,
	generateHexagonCells,
	hexagonCorners,
	HEXAGON_GRID_RADII,
} from '@/domain/shapes/hexagon'
import {
	generateTriangleCells,
	TRIANGLE_GRID_SIZES,
} from '@/domain/shapes/triangle'

export type PuzzleShapeId = 'hexagon' | 'triangle'

export interface PuzzleCell extends AxialCoord {
	readonly groupId: string
	readonly isClickable: boolean
}

export interface PuzzleShape {
	readonly id: PuzzleShapeId
	readonly gridSizes: Readonly<Record<GridSize, number>>
	readonly pieceSizes: Readonly<Record<GridSize, readonly number[]>>
	readonly cells: (gridSize: number) => PuzzleCell[]
	readonly neighbors: (cell: AxialCoord) => AxialCoord[]
	// Lattice point that piece tiles are offset from, so 60-degree rotations
	// of those offsets land on other cells.
	readonly anchorFor: (cell: AxialCoord) => AxialCoord
	readonly corners: (cell: AxialCoord, size: number) => Point[]
	readonly center: (cell: AxialCoord, size: number) => Point
}

const hexDirections: readonly AxialCoord[] = [
	{ q: 1, r: 0 },
	{ q: 0, r: 1 },
	{ q: -1, r: 1 },
	{ q: -1, r: 0 },
	{ q: 0, r: -1 },
	{ q: 1, r: -1 },
]

const hexagon: PuzzleShape = {
	id: 'hexagon',
	gridSizes: HEXAGON_GRID_RADII,
	pieceSizes: { sm: [3, 2, 1], md: [3, 3, 2, 1], lg: [3, 3, 3, 3, 2, 1, 1] },
	cells: radius => generateHexagonCells(radius),
	neighbors: cell =>
		hexDirections.map(d => ({ q: cell.q + d.q, r: cell.r + d.r })),
	anchorFor: cell => ({ q: cell.q, r: cell.r }),
	corners: (cell, size) => {
		const layout = { orientation: 'flat', size } as const
		return hexagonCorners(axialToPixel(cell, layout), layout)
	},
	center: (cell, size) => axialToPixel(cell, { orientation: 'flat', size }),
}

// Triangle tiles are addressed by 3x their centroid in axial coordinates of the
// triangle lattice's vertices (basis (1, 0) and (1/2, sqrt(3)/2)). Up-pointing
// tiles have q and r congruent to 2 (mod 3), down-pointing tiles 1 (mod 3), and
// vertices 0 (mod 3). Rotating 60 degrees about a vertex swaps up and down.
function isUp({ q }: AxialCoord): boolean {
	return ((q % 3) + 3) % 3 === 2
}

const upNeighbors: readonly AxialCoord[] = [
	{ q: 2, r: -1 },
	{ q: -1, r: -1 },
	{ q: -1, r: 2 },
]

function triangleVertices(cell: AxialCoord): AxialCoord[] {
	const vertex = isUp(cell)
		? { q: (cell.q + 1) / 3, r: (cell.r - 2) / 3 }
		: { q: (cell.q - 1) / 3, r: (cell.r - 1) / 3 }
	const [second, third] = isUp(cell)
		? [
				{ q: -1, r: 1 },
				{ q: 0, r: 1 },
			]
		: [
				{ q: 1, r: 0 },
				{ q: 0, r: 1 },
			]
	return [
		vertex,
		{ q: vertex.q + second.q, r: vertex.r + second.r },
		{ q: vertex.q + third.q, r: vertex.r + third.r },
	]
}

const SQRT3 = Math.sqrt(3)

// Converts 3x-scaled axial coordinates to pixels in the triangle basis.
function trianglePixel({ q, r }: AxialCoord, size: number): Point {
	return { x: size * (q + r / 2), y: size * r * (SQRT3 / 2) }
}

const triangle: PuzzleShape = {
	id: 'triangle',
	gridSizes: TRIANGLE_GRID_SIZES,
	pieceSizes: { sm: [3, 2], md: [4, 3, 3, 2], lg: [4, 4, 4, 3, 3, 2, 1, 1] },
	cells: gridSize =>
		generateTriangleCells(gridSize).map(
			({ row, col, direction, groupId, isClickable }) => ({
				q: 3 * (col - row) + (direction === 'up' ? -1 : 1),
				r: 3 * row + (direction === 'up' ? 2 : 1),
				groupId,
				isClickable,
			}),
		),
	neighbors: cell => {
		const sign = isUp(cell) ? 1 : -1
		return upNeighbors.map(d => ({
			q: cell.q + sign * d.q,
			r: cell.r + sign * d.r,
		}))
	},
	anchorFor: cell => {
		const { q, r } = triangleVertices(cell)[0]
		return { q: 3 * q, r: 3 * r }
	},
	corners: (cell, size) =>
		triangleVertices(cell).map(vertex => trianglePixel(vertex, size)),
	center: (cell, size) => trianglePixel(cell, size / 3),
}

export const puzzleShapes: Readonly<Record<PuzzleShapeId, PuzzleShape>> = {
	hexagon,
	triangle,
}

export function isPuzzleShapeId(value: unknown): value is PuzzleShapeId {
	return value === 'hexagon' || value === 'triangle'
}
