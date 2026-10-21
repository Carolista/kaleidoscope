import type { Point } from '@/domain/geometry'
import { supportedGridShapes } from '@/domain/shapes'
import type { GridShapeId, GridSize } from '@/domain/shapes'
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
import {
	CIRCLE_RINGS_GRID_SIZES,
	circleRingsCellCenter,
	circleRingsCellRadius,
	generateCircleRingsCells,
} from '@/domain/shapes/circle-rings'
import {
	generateHexagramCells,
	HEXAGRAM_GRID_SIZES,
	hexagramStarCellCorners,
} from '@/domain/shapes/hexagram'
import {
	generatePinwheelCells,
	PINWHEEL_GRID_SIZES,
	PINWHEEL_ROTATIONS,
	spokeCellCorners,
} from '@/domain/shapes/pinwheel'
import {
	DIAMOND_STAR_GRID_SIZES,
	DIAMOND_STAR_ROTATIONS,
	diamondCellCorners,
	generateDiamondStarCells,
} from '@/domain/shapes/diamond-star'

export const PUZZLE_SHAPE_IDS = [
	'hexagon',
	'triangle',
	'diamondStar',
	'hexagram',
	'circleRings',
	'pinwheel',
] as const satisfies readonly GridShapeId[]

export type PuzzleShapeId = (typeof PUZZLE_SHAPE_IDS)[number]

// Board-only position (e.g. which star point) for shapes whose mirrored copies
// reuse the wedge's coordinates. Wedge cells and piece tiles omit it.
export interface PlacedCoord extends AxialCoord {
	readonly transform?: number
}

export interface PuzzleCell extends PlacedCoord {
	readonly groupId: string
	readonly isClickable: boolean
}

export interface PuzzleShape {
	readonly id: PuzzleShapeId
	readonly gridSizes: Readonly<Record<GridSize, number>>
	readonly pieceSizes: Readonly<Record<GridSize, readonly number[]>>
	// Smallest piece rotation that keeps tiles on the grid, in 60-degree steps.
	readonly rotationStep: 1 | 3
	readonly cells: (gridSize: number) => PuzzleCell[]
	readonly neighbors: (cell: AxialCoord) => AxialCoord[]
	// Lattice point that piece tiles are offset from, so 60-degree rotations
	// of those offsets land on other cells.
	readonly anchorFor: (cell: AxialCoord) => AxialCoord
	readonly corners: (cell: PlacedCoord, size: number) => Point[]
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
	rotationStep: 1,
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

// Shared by every shape tiled with equilateral triangles on one lattice.
const triangleLattice = {
	rotationStep: 1,
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
} satisfies Pick<
	PuzzleShape,
	'rotationStep' | 'neighbors' | 'anchorFor' | 'corners' | 'center'
>

const triangle: PuzzleShape = {
	...triangleLattice,
	id: 'triangle',
	gridSizes: TRIANGLE_GRID_SIZES,
	pieceSizes: {
		sm: [3, 2, 2],
		md: [4, 3, 3, 2],
		lg: [4, 4, 4, 3, 3, 2, 1, 1],
	},
	cells: gridSize =>
		generateTriangleCells(gridSize).map(
			({ row, col, direction, groupId, isClickable }) => ({
				q: 3 * (col - row) + (direction === 'up' ? -1 : 1),
				r: 3 * row + (direction === 'up' ? 2 : 1),
				groupId,
				isClickable,
			}),
		),
}

// Hexagram tiles sit on the same lattice, centered on a vertex, so each tile's
// coordinates come from its centroid (3x centroid = the sum of its corners).
const hexagram: PuzzleShape = {
	...triangleLattice,
	id: 'hexagram',
	gridSizes: HEXAGRAM_GRID_SIZES,
	pieceSizes: { sm: [3, 2, 1], md: [4, 3, 3, 2], lg: [4, 4, 4, 3, 2, 2, 1] },
	cells: gridSize =>
		generateHexagramCells(gridSize).map(cell => {
			const corners = hexagramStarCellCorners(cell, { gridSize, size: 1 })
			const x = corners.reduce((sum, point) => sum + point.x, 0)
			const r =
				corners.reduce((sum, point) => sum + point.y, 0) / (SQRT3 / 2)
			return {
				q: Math.round(x - r / 2),
				r: Math.round(r),
				groupId: cell.groupId,
				isClickable: cell.isClickable,
			}
		}),
}

// Diamond-star tiles are (row, col) rhombi of one star point; the wedge is the
// point's right half. Rhombi only realign after a half turn, so a 180-degree
// rotation (three 60-degree axial steps, i.e. (q, r) -> (-q, -r)) is the only one.
function diamondCorners(cell: PlacedCoord, size: number): Point[] {
	const transform = DIAMOND_STAR_ROTATIONS[cell.transform ?? 0]
	return diamondCellCorners(
		{ row: cell.q, col: cell.r },
		{ gridSize: 1, size },
	).map(transform)
}

// Shared by shapes tiled with (row, col) parallelograms: four edge neighbours,
// anchored on a tile, and only a half turn keeps tiles on the grid.
function parallelogramLattice(
	corners: (cell: PlacedCoord, size: number) => Point[],
) {
	return {
		rotationStep: 3,
		neighbors: ({ q, r }) => [
			{ q: q + 1, r },
			{ q: q - 1, r },
			{ q, r: r + 1 },
			{ q, r: r - 1 },
		],
		anchorFor: cell => ({ q: cell.q, r: cell.r }),
		corners,
		center: (cell, size) => {
			const [first, , third] = corners(cell, size)
			return { x: (first.x + third.x) / 2, y: (first.y + third.y) / 2 }
		},
	} satisfies Pick<
		PuzzleShape,
		'rotationStep' | 'neighbors' | 'anchorFor' | 'corners' | 'center'
	>
}

const diamondStar: PuzzleShape = {
	...parallelogramLattice(diamondCorners),
	id: 'diamondStar',
	gridSizes: DIAMOND_STAR_GRID_SIZES,
	pieceSizes: { sm: [3, 2, 1], md: [4, 3, 2, 1], lg: [4, 4, 3, 2, 1, 1] },
	cells: gridSize =>
		generateDiamondStarCells(gridSize).map(
			({ row, col, transformIndex, groupId, isClickable }) => ({
				q: row,
				r: col,
				...(transformIndex ? { transform: transformIndex } : {}),
				groupId,
				isClickable,
			}),
		),
}

// Pinwheel tiles are (row, col) parallelograms of one spoke; the wedge is the
// whole top spoke. Its grid is rows x columns of steps, identified by
// rows * 10 + columns (1 to 9 steps each way): 32 is 3 rows by 2 columns.
export function pinwheelGridSize(rowSteps: number, colSteps: number): number {
	return rowSteps * 10 + colSteps
}

export function pinwheelSteps(size: number) {
	const rowSteps = Math.floor(size / 10)
	const colSteps = size % 10
	if (Number.isInteger(size) && rowSteps >= 1 && colSteps >= 1)
		return { rowSteps, colSteps }
	throw new Error('Unsupported pinwheel size.')
}

const pinwheel: PuzzleShape = {
	...parallelogramLattice((cell, size) =>
		spokeCellCorners(
			{ row: cell.q, col: cell.r },
			{ rowSteps: 1, colSteps: 1, size },
		).map(PINWHEEL_ROTATIONS[cell.transform ?? 0]),
	),
	id: 'pinwheel',
	gridSizes: {
		sm: pinwheelGridSize(
			PINWHEEL_GRID_SIZES.sm.rowSteps,
			PINWHEEL_GRID_SIZES.sm.colSteps,
		),
		md: pinwheelGridSize(
			PINWHEEL_GRID_SIZES.md.rowSteps,
			PINWHEEL_GRID_SIZES.md.colSteps,
		),
		lg: pinwheelGridSize(
			PINWHEEL_GRID_SIZES.lg.rowSteps,
			PINWHEEL_GRID_SIZES.lg.colSteps,
		),
	},
	pieceSizes: { sm: [3, 2, 1], md: [3, 3, 2, 1], lg: [3, 3, 3, 2, 1] },
	cells: tiles => {
		const { rowSteps, colSteps } = pinwheelSteps(tiles)
		return generatePinwheelCells(rowSteps, colSteps).map(
			({ row, col, transformIndex, groupId, isClickable }) => ({
				q: row,
				r: col,
				...(transformIndex ? { transform: transformIndex } : {}),
				groupId,
				isClickable,
			}),
		)
	},
}

// Ring k of circle rings has 6k circles, like ring k of a hexagon grid, so each
// circle maps to the hex cell at the same ring position (clockwise from the top
// corner). Hex neighbours are the touching circles, and 60-degree hex rotation
// maps every ring onto itself. Circles are drawn as fine polygons.
const ringCorners: readonly AxialCoord[] = [
	{ q: 0, r: -1 },
	{ q: 1, r: -1 },
	{ q: 1, r: 0 },
	{ q: 0, r: 1 },
	{ q: -1, r: 1 },
	{ q: -1, r: 0 },
]

function hexAtRing(ring: number, index: number): AxialCoord {
	if (ring === 0) return { q: 0, r: 0 }
	const side = Math.floor(index / ring)
	const step = index % ring
	const from = ringCorners[side]
	const to = ringCorners[(side + 1) % 6]
	return {
		q: ring * from.q + step * (to.q - from.q),
		r: ring * from.r + step * (to.r - from.r),
	}
}

function ringAtHex(cell: AxialCoord): { ring: number; index: number } {
	const ring = Math.max(
		Math.abs(cell.q),
		Math.abs(cell.r),
		Math.abs(cell.q + cell.r),
	)
	for (let index = 0; index < Math.max(1, 6 * ring); index++) {
		const candidate = hexAtRing(ring, index)
		if (candidate.q === cell.q && candidate.r === cell.r)
			return { ring, index }
	}
	throw new Error('Unreachable circle-ring coordinate.')
}

const CIRCLE_SEGMENTS = 32

const circleRings: PuzzleShape = {
	...hexagon,
	id: 'circleRings',
	gridSizes: CIRCLE_RINGS_GRID_SIZES,
	pieceSizes: { ...hexagon.pieceSizes, lg: [4, 3, 2, 2, 1] },
	cells: ringCount =>
		generateCircleRingsCells(ringCount).map(
			({ ring, index, groupId, isClickable }) => ({
				...hexAtRing(ring, index),
				groupId,
				isClickable,
			}),
		),
	corners: (cell, size) => {
		const position = ringAtHex(cell)
		const layout = { ringCount: 0, size }
		const center = circleRingsCellCenter(position, layout)
		const radius = circleRingsCellRadius(position, layout)
		return Array.from({ length: CIRCLE_SEGMENTS }, (_, i) => {
			const angle = (2 * Math.PI * i) / CIRCLE_SEGMENTS
			return {
				x: center.x + radius * Math.cos(angle),
				y: center.y + radius * Math.sin(angle),
			}
		})
	},
	center: (cell, size) =>
		circleRingsCellCenter(ringAtHex(cell), { ringCount: 0, size }),
}

export const puzzleShapes: Readonly<Record<PuzzleShapeId, PuzzleShape>> = {
	hexagon,
	triangle,
	diamondStar,
	hexagram,
	circleRings,
	pinwheel,
}

export function isPuzzleShapeId(value: unknown): value is PuzzleShapeId {
	return PUZZLE_SHAPE_IDS.some(id => id === value)
}

function catalogLabel(shape: PuzzleShapeId): string {
	return supportedGridShapes.find(option => option.id === shape)!.label
}

export const PUZZLE_SHAPE_LABELS: Readonly<Record<PuzzleShapeId, string>> = {
	hexagon: catalogLabel('hexagon'),
	triangle: catalogLabel('triangle'),
	diamondStar: catalogLabel('diamondStar'),
	hexagram: catalogLabel('hexagram'),
	circleRings: catalogLabel('circleRings'),
	pinwheel: catalogLabel('pinwheel'),
}
