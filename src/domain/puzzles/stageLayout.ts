import {
	coverPolygons,
	createOccupancyGrid,
	distanceToCovered,
	enclosingCircle,
	polygonBoundingBox,
	type OccupancyGrid,
	type Point,
} from '@/domain/geometry'
import { rotateCoordinate, type Puzzle } from './puzzle'
import { puzzleShapes } from './puzzleShapes'

// Lays a puzzle out as one stage: the board is the biggest shape, the target is
// the next biggest, and each piece is a circle that fits in whatever room is
// left around the board. A piece's circle holds it in every orientation, so
// turning a piece never moves it or bumps a neighbor.

// Board units of empty margin around the board's drawn cells (PuzzleBoard's
// view box pads by the same amount).
export const STAGE_BOARD_PADDING = 3
// Board units added around a piece's tiles for the outline stroke.
const PIECE_MARGIN = 1
// Pieces are drawn between these fractions of the board's own tile size. The
// top keeps them from crowding each other and the board.
export const MIN_PIECE_SCALE = 0.5
export const MAX_PIECE_SCALE = 0.75
const PIECE_SCALE_STEP = 0.05

// Resolution of the placement search, and the least space kept between things (pixels).
const CELL = 3
const GAP = 4
// Once everything fits, pieces spread out to the largest of these gaps that
// still works, so they sit loosely in the top right corner rather than hugging
// the board.
const SPREAD_GAPS = [22, 16, 11, 7]
// The target is drawn this fraction of the size of the room kept for it, in
// that room's top left corner, so it does not cling to the board.
const TARGET_DRAWN = 0.9
// How far from the corner the target may start, as a fraction of the stage.
const TARGET_CORNER = 0.05
// Pieces gather on the right: their centers stay past this fraction of the width.
const PIECES_FROM = 0.4

// Portrait: the target's width as a fraction of the stage width, tried largest
// first, and how much taller than the board the stage may grow before the
// target is shrunk instead (as a fraction of the board's height).
const PORTRAIT_TARGET_FRACTIONS = [0.55, 0.5, 0.45, 0.4, 0.35]
const PORTRAIT_EXTRA_BUDGET = 0.45
const PORTRAIT_EXTRA_LIMIT = 1.5
// Landscape: the board takes at most this much of the width, and the target is
// tried from the largest fraction down in these steps.
const LANDSCAPE_BOARD_WIDTH = 0.62
const LANDSCAPE_TARGET_MAX = 0.48
const LANDSCAPE_TARGET_MIN = 0.15
const LANDSCAPE_TARGET_STEP = 0.025
const LANDSCAPE_BOARD_SHRINKS = [1, 0.92, 0.85, 0.78]

type Polygons = readonly (readonly Point[])[]

export interface StageBoard {
	// Every cell outline, in board units.
	readonly polygons: Polygons
}

export function puzzleStageBoard(puzzle: Puzzle, tileSize: number): StageBoard {
	const shape = puzzleShapes[puzzle.shape]
	return {
		polygons: shape
			.cells(puzzle.gridSize)
			.map(cell => shape.corners(cell, tileSize)),
	}
}

// How far each piece reaches from the center it is drawn around, in board
// units, over every orientation the player can turn it to.
export function puzzlePieceRadii(puzzle: Puzzle, tileSize: number): number[] {
	const shape = puzzleShapes[puzzle.shape]
	const cornersOf = shape.pieceCorners ?? shape.corners
	const turns = puzzle.rotationAllowed ? 6 / shape.rotationStep : 1
	return puzzle.pieces.map(
		piece =>
			PIECE_MARGIN +
			Math.max(
				...Array.from(
					{ length: turns },
					(_, turn) =>
						enclosingCircle(
							piece.tiles.flatMap(tile =>
								cornersOf(
									rotateCoordinate(
										tile,
										turn * shape.rotationStep,
									),
									tileSize,
								),
							),
						).radius,
				),
			),
	)
}

export interface StageRect {
	readonly x: number
	readonly y: number
	readonly width: number
	readonly height: number
}

export interface StagePiece {
	// The circle's center and radius, in pixels.
	readonly x: number
	readonly y: number
	readonly radius: number
}

export interface StageLayout {
	readonly width: number
	readonly height: number
	// Pixels per board unit for the board, the target, and tray pieces.
	readonly boardScale: number
	readonly targetScale: number
	readonly pieceScale: number
	// The board's cells (without STAGE_BOARD_PADDING) and the target's.
	readonly board: StageRect
	readonly target: StageRect
	// In the order of the radii given.
	readonly pieces: readonly StagePiece[]
}

export type StageRequest = {
	readonly board: StageBoard
	readonly pieceRadii: readonly number[]
	readonly width: number
} & (
	| { readonly mode: 'portrait' }
	| { readonly mode: 'landscape'; readonly height: number }
)

interface TargetTemplate {
	readonly width: number
	readonly height: number
	readonly polygons: Polygons
	// Covered cells of the target's outline, edge cells first so a bad spot
	// fails early.
	readonly cells: readonly (readonly [col: number, row: number])[]
	readonly grid: OccupancyGrid
}

interface Placement {
	readonly target: Point
	readonly pieces: readonly Point[]
}

function targetTemplate(
	board: StageBoard,
	box: ReturnType<typeof polygonBoundingBox>,
	width: number,
): TargetTemplate {
	const scale = width / (box.maxX - box.minX)
	const height = (box.maxY - box.minY) * scale
	const polygons = board.polygons.map(polygon =>
		polygon.map(point => ({
			x: (point.x - box.minX) * scale,
			y: (point.y - box.minY) * scale,
		})),
	)
	const grid = createOccupancyGrid(width, height, CELL)
	coverPolygons(grid, polygons)
	const edge: [number, number][] = []
	const inside: [number, number][] = []
	const covered = (col: number, row: number) =>
		col >= 0 &&
		row >= 0 &&
		col < grid.cols &&
		row < grid.rows &&
		grid.cells[row * grid.cols + col] === 1
	for (let row = 0; row < grid.rows; row++)
		for (let col = 0; col < grid.cols; col++) {
			if (!covered(col, row)) continue
			const onEdge =
				!covered(col - 1, row) ||
				!covered(col + 1, row) ||
				!covered(col, row - 1) ||
				!covered(col, row + 1)
			;(onEdge ? edge : inside).push([col, row])
		}
	return { width, height, polygons, cells: [...edge, ...inside], grid }
}

// Finds room for the target (in the upper left corner, as high and far left as
// it goes) and every piece (as near the upper right corner as they go), or null.
function place({
	base,
	bounds,
	target,
	radii,
	gap = GAP,
}: {
	readonly base: OccupancyGrid
	// The stage's real size in pixels; the grid may overhang it by a cell.
	readonly bounds: { readonly width: number; readonly height: number }
	readonly target: TargetTemplate
	readonly radii: readonly number[]
	readonly gap?: number
}): Placement | null {
	const { cols, rows } = base
	const { width, height } = bounds
	const focus = { x: width, y: 0 }
	const room = distanceToCovered(base)
	const clearance = GAP + CELL
	// The target must stay in the upper left corner; when the board blocks it
	// there, a smaller target or a taller stage is used instead.
	const maxCol = Math.min(
		cols - target.grid.cols,
		Math.floor(cols * TARGET_CORNER),
	)
	const maxRow = Math.min(
		rows - target.grid.rows,
		Math.floor(rows * TARGET_CORNER),
	)
	if (cols < target.grid.cols || rows < target.grid.rows) return null
	let spot: { col: number; row: number } | null = null
	for (let row = 0; row <= maxRow && !spot; row++)
		for (let col = 0; col <= maxCol && !spot; col++)
			if (
				target.cells.every(
					([c, r]) => room[(row + r) * cols + col + c] >= clearance,
				)
			)
				spot = { col, row }
	if (!spot) return null

	const covered = { ...base, cells: base.cells.slice() }
	for (const [c, r] of target.cells)
		covered.cells[(spot.row + r) * cols + spot.col + c] = 1
	const left = distanceToCovered(covered)
	const placed: { x: number; y: number; radius: number }[] = []
	const byIndex: Point[] = []
	const order = radii
		.map((radius, index) => ({ radius, index }))
		.sort((a, b) => b.radius - a.radius)
	for (const { radius, index } of order) {
		let best: Point | null = null
		let bestCost = Infinity
		for (let row = 0; row < rows; row++) {
			const y = (row + 0.5) * CELL
			if (y - radius < 0 || y + radius > height) continue
			for (
				let col = Math.floor((width * PIECES_FROM) / CELL);
				col < cols;
				col++
			) {
				const x = (col + 0.5) * CELL
				if (x - radius < 0 || x + radius > width) continue
				if (left[row * cols + col] < radius + gap + CELL / 2) continue
				const cost = Math.hypot(x - focus.x, y - focus.y)
				if (cost >= bestCost) continue
				if (
					placed.some(
						other =>
							Math.hypot(other.x - x, other.y - y) <
							other.radius + radius + gap,
					)
				)
					continue
				best = { x, y }
				bestCost = cost
			}
		}
		if (!best) return null
		placed.push({ ...best, radius })
		byIndex[index] = best
	}
	return {
		target: { x: spot.col * CELL, y: spot.row * CELL },
		pieces: byIndex,
	}
}

// The loosest spacing at which everything still fits, or null if only the
// tightest spacing does.
function spreadOut(attemptWith: (gap: number) => Placement | null) {
	for (const gap of SPREAD_GAPS) {
		const placement = attemptWith(gap)
		if (placement) return placement
	}
	return null
}

// The target is drawn smaller than the room kept for it, tucked in that room's
// top left corner.
function drawnTarget(spot: Point, template: TargetTemplate): StageRect {
	return {
		x: spot.x,
		y: spot.y,
		width: template.width * TARGET_DRAWN,
		height: template.height * TARGET_DRAWN,
	}
}

// The largest piece scale that still fits, by halving the gap between a scale
// known to fit and one known not to.
function largestPieceScale(fits: (scale: number) => boolean): number | null {
	if (fits(MAX_PIECE_SCALE)) return MAX_PIECE_SCALE
	if (!fits(MIN_PIECE_SCALE)) return null
	let fitting = MIN_PIECE_SCALE
	let failing = MAX_PIECE_SCALE
	while (failing - fitting > PIECE_SCALE_STEP * 1.5) {
		const middle =
			Math.round((fitting + failing) / 2 / PIECE_SCALE_STEP) *
			PIECE_SCALE_STEP
		if (middle <= fitting || middle >= failing) break
		if (fits(middle)) fitting = middle
		else failing = middle
	}
	return fitting
}

function packPortrait(request: StageRequest): StageLayout | null {
	const { board, pieceRadii, width } = request
	const box = polygonBoundingBox(board.polygons)
	const boardWidth = box.maxX - box.minX
	const boardHeight = box.maxY - box.minY
	const scale = width / (boardWidth + 2 * STAGE_BOARD_PADDING)
	const pad = STAGE_BOARD_PADDING * scale
	const drawnHeight = (boardHeight + 2 * STAGE_BOARD_PADDING) * scale
	const roundToCell = (pixels: number) => Math.floor(pixels / CELL) * CELL
	const limit = roundToCell(PORTRAIT_EXTRA_LIMIT * boardHeight * scale)
	const budget = roundToCell(PORTRAIT_EXTRA_BUDGET * boardHeight * scale)

	// One grid with the board at the bottom and room above it; a shorter stage
	// is the same grid without its top rows.
	const full = createOccupancyGrid(width, limit + drawnHeight, CELL)
	coverPolygons(
		full,
		board.polygons.map(polygon =>
			polygon.map(point => ({
				x: (point.x - box.minX) * scale + pad,
				y: (point.y - box.minY) * scale + pad + limit,
			})),
		),
	)
	const templates = new Map<number, TargetTemplate>()
	const templateFor = (targetWidth: number) => {
		let template = templates.get(targetWidth)
		if (!template) {
			template = targetTemplate(board, box, targetWidth)
			templates.set(targetWidth, template)
		}
		return template
	}
	const attempt = (
		targetWidth: number,
		pieceScale: number,
		extra: number,
		gap = GAP,
	) => {
		const firstRow = (limit - extra) / CELL
		const base: OccupancyGrid = {
			cols: full.cols,
			rows: full.rows - firstRow,
			step: CELL,
			cells: full.cells.slice(firstRow * full.cols),
		}
		return place({
			base,
			bounds: { width, height: extra + drawnHeight },
			target: templateFor(targetWidth),
			radii: pieceRadii.map(radius => radius * scale * pieceScale),
			gap,
		})
	}
	const smallestExtra = (
		targetWidth: number,
		pieceScale: number,
		most: number,
	) => {
		let extra = 0
		let placement = attempt(targetWidth, pieceScale, 0)
		if (placement) return { extra, placement }
		let failing = 0
		let fitting = most / CELL
		placement = attempt(targetWidth, pieceScale, most)
		if (!placement) return null
		while (fitting - failing > 1) {
			const middle = Math.floor((fitting + failing) / 2)
			const result = attempt(targetWidth, pieceScale, middle * CELL)
			if (result) {
				fitting = middle
				placement = result
			} else failing = middle
		}
		extra = fitting * CELL
		return { extra, placement }
	}
	const build = (
		targetWidth: number,
		pieceScale: number,
		extra: number,
		found: Placement,
	): StageLayout => {
		const template = templateFor(targetWidth)
		const placement =
			spreadOut(gap => attempt(targetWidth, pieceScale, extra, gap)) ??
			found
		return {
			width,
			height: extra + drawnHeight,
			boardScale: scale,
			targetScale: (TARGET_DRAWN * template.width) / boardWidth,
			pieceScale: scale * pieceScale,
			board: {
				x: pad,
				y: extra + pad,
				width: boardWidth * scale,
				height: boardHeight * scale,
			},
			target: drawnTarget(placement.target, template),
			pieces: pieceRadii.map((radius, index) => ({
				...placement.pieces[index],
				radius: radius * scale * pieceScale,
			})),
		}
	}

	for (const fraction of PORTRAIT_TARGET_FRACTIONS) {
		const targetWidth = Math.round(fraction * width)
		if (!attempt(targetWidth, MIN_PIECE_SCALE, budget)) continue
		const pieceScale = largestPieceScale(
			candidate => attempt(targetWidth, candidate, budget) !== null,
		)
		if (pieceScale === null) continue
		const result = smallestExtra(targetWidth, pieceScale, budget)
		if (result)
			return build(
				targetWidth,
				pieceScale,
				result.extra,
				result.placement,
			)
	}
	// Nothing fits in the budget: take the smallest target and pieces, and grow.
	const targetWidth = Math.round(
		PORTRAIT_TARGET_FRACTIONS[PORTRAIT_TARGET_FRACTIONS.length - 1] * width,
	)
	const result = smallestExtra(targetWidth, MIN_PIECE_SCALE, limit)
	return result
		? build(targetWidth, MIN_PIECE_SCALE, result.extra, result.placement)
		: null
}

function packLandscape(
	request: StageRequest & { readonly mode: 'landscape' },
): StageLayout | null {
	const { board, pieceRadii, width, height } = request
	const box = polygonBoundingBox(board.polygons)
	const boardWidth = box.maxX - box.minX
	const boardHeight = box.maxY - box.minY
	const fullScale = Math.min(
		height / (boardHeight + 2 * STAGE_BOARD_PADDING),
		(LANDSCAPE_BOARD_WIDTH * width) /
			(boardWidth + 2 * STAGE_BOARD_PADDING),
	)
	for (const shrink of LANDSCAPE_BOARD_SHRINKS) {
		const scale = fullScale * shrink
		const boardX = (width - boardWidth * scale) / 2
		const boardY = (height - boardHeight * scale) / 2
		const base = createOccupancyGrid(width, height, CELL)
		coverPolygons(
			base,
			board.polygons.map(polygon =>
				polygon.map(point => ({
					x: (point.x - box.minX) * scale + boardX,
					y: (point.y - box.minY) * scale + boardY,
				})),
			),
		)
		const attempt = (targetWidth: number, pieceScale: number, gap = GAP) =>
			place({
				base,
				bounds: { width, height },
				target: targetTemplate(board, box, targetWidth),
				radii: pieceRadii.map(radius => radius * scale * pieceScale),
				gap,
			})
		for (
			let fraction = LANDSCAPE_TARGET_MAX;
			fraction >= LANDSCAPE_TARGET_MIN - 1e-9;
			fraction -= LANDSCAPE_TARGET_STEP
		) {
			const targetWidth = Math.round(fraction * width)
			if (!attempt(targetWidth, MIN_PIECE_SCALE)) continue
			const pieceScale = largestPieceScale(
				candidate => attempt(targetWidth, candidate) !== null,
			)
			if (pieceScale === null) continue
			const placement =
				spreadOut(gap => attempt(targetWidth, pieceScale, gap)) ??
				attempt(targetWidth, pieceScale)
			if (!placement) continue
			const template = targetTemplate(board, box, targetWidth)
			return {
				width,
				height,
				boardScale: scale,
				targetScale: (TARGET_DRAWN * template.width) / boardWidth,
				pieceScale: scale * pieceScale,
				board: {
					x: boardX,
					y: boardY,
					width: boardWidth * scale,
					height: boardHeight * scale,
				},
				target: drawnTarget(placement.target, template),
				pieces: pieceRadii.map((radius, index) => ({
					...placement.pieces[index],
					radius: radius * scale * pieceScale,
				})),
			}
		}
	}
	return null
}

// Positions for the board, target, and pieces, or null when they cannot all
// fit (callers then keep their usual layout).
export function packPuzzleStage(request: StageRequest): StageLayout | null {
	return request.mode === 'portrait'
		? packPortrait(request)
		: packLandscape(request)
}
