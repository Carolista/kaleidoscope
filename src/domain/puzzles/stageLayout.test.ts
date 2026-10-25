import { describe, expect, it } from 'vitest'
import { pointInPolygon, polygonBoundingBox } from '@/domain/geometry'
import { palettes } from '@/test/playerContent'
import { tileSizes } from '@/ui/puzzle/tileSizes'
import { generatePuzzle, PUZZLE_RECIPES, rotateCoordinate } from './puzzle'
import { puzzleShapes, type PuzzleShapeId } from './puzzleShapes'
import {
	MAX_PIECE_SCALE,
	MIN_PIECE_SCALE,
	packPuzzleStage,
	puzzlePieceRadii,
	puzzleStageBoard,
	type StageLayout,
	type StageRequest,
} from './stageLayout'

const shapeIds = Object.keys(puzzleShapes) as PuzzleShapeId[]
const palette = palettes[0]

function largeRotationPuzzle(shape: PuzzleShapeId) {
	return generatePuzzle('stage-layout', palette, PUZZLE_RECIPES[5], shape)
}

function requestFor(
	shape: PuzzleShapeId,
	mode: StageRequest['mode'],
): StageRequest {
	const puzzle = largeRotationPuzzle(shape)
	const base = {
		board: puzzleStageBoard(puzzle, tileSizes[shape]),
		pieceRadii: puzzlePieceRadii(puzzle, tileSizes[shape]),
	}
	return mode === 'portrait'
		? { ...base, mode, width: 366 }
		: { ...base, mode, width: 1000, height: 600 }
}

type Outlines = readonly (readonly { x: number; y: number }[])[]

// Cell outlines scaled to `width` pixels wide with their box's corner at (x, y).
function outlinesAt(
	request: StageRequest,
	x: number,
	y: number,
	scale: number,
): Outlines {
	const box = polygonBoundingBox(request.board.polygons)
	return request.board.polygons.map(polygon =>
		polygon.map(point => ({
			x: (point.x - box.minX) * scale + x,
			y: (point.y - box.minY) * scale + y,
		})),
	)
}

function covers(outlines: Outlines, x: number, y: number) {
	return outlines.some(polygon => pointInPolygon(x, y, polygon))
}

describe.each(shapeIds)('stage layout for %s', shape => {
	describe.each(['portrait', 'landscape'] as const)('%s', mode => {
		const request = requestFor(shape, mode)
		const layout: StageLayout | null = packPuzzleStage(request)

		it('finds room for everything', () => {
			expect(layout).not.toBeNull()
		})

		it('keeps the board, target, and pieces inside the stage', () => {
			if (!layout) return
			for (const rect of [layout.board, layout.target]) {
				expect(rect.x).toBeGreaterThanOrEqual(0)
				expect(rect.y).toBeGreaterThanOrEqual(0)
				expect(rect.x + rect.width).toBeLessThanOrEqual(
					layout.width + 1,
				)
				expect(rect.y + rect.height).toBeLessThanOrEqual(
					layout.height + 1,
				)
			}
			for (const piece of layout.pieces) {
				expect(piece.x - piece.radius).toBeGreaterThanOrEqual(0)
				expect(piece.y - piece.radius).toBeGreaterThanOrEqual(0)
				expect(piece.x + piece.radius).toBeLessThanOrEqual(layout.width)
				expect(piece.y + piece.radius).toBeLessThanOrEqual(
					layout.height,
				)
			}
		})

		it('keeps pieces apart from each other, the board, and the target', () => {
			if (!layout) return
			const board = outlinesAt(
				request,
				layout.board.x,
				layout.board.y,
				layout.boardScale,
			)
			const box = polygonBoundingBox(request.board.polygons)
			const target = outlinesAt(
				request,
				layout.target.x,
				layout.target.y,
				layout.target.width / (box.maxX - box.minX),
			)
			layout.pieces.forEach((piece, index) => {
				for (let step = 0; step < 24; step++) {
					const angle = (step / 24) * 2 * Math.PI
					const x = piece.x + piece.radius * Math.cos(angle)
					const y = piece.y + piece.radius * Math.sin(angle)
					expect(covers(board, x, y)).toBe(false)
					expect(covers(target, x, y)).toBe(false)
				}
				layout.pieces.slice(index + 1).forEach(other => {
					expect(
						Math.hypot(piece.x - other.x, piece.y - other.y),
					).toBeGreaterThanOrEqual(piece.radius + other.radius)
				})
			})
			for (
				let x = layout.target.x;
				x < layout.target.x + layout.target.width;
				x += 6
			)
				for (
					let y = layout.target.y;
					y < layout.target.y + layout.target.height;
					y += 6
				)
					if (covers(target, x, y))
						expect(covers(board, x, y)).toBe(false)
		})

		it('tucks the target into the upper left corner', () => {
			if (!layout) return
			expect(layout.target.x).toBeLessThanOrEqual(layout.width * 0.06)
			expect(layout.target.y).toBeLessThanOrEqual(layout.height * 0.06)
		})

		it('gathers pieces toward the upper right', () => {
			if (!layout) return
			const average = (values: number[]) =>
				values.reduce((sum, value) => sum + value, 0) / values.length
			expect(
				average(layout.pieces.map(piece => piece.x)),
			).toBeGreaterThan(layout.width / 2)
		})

		it('draws pieces between the minimum and maximum scale of the board', () => {
			if (!layout) return
			const ratio = layout.pieceScale / layout.boardScale
			expect(ratio).toBeGreaterThanOrEqual(MIN_PIECE_SCALE - 1e-9)
			expect(ratio).toBeLessThanOrEqual(MAX_PIECE_SCALE + 1e-9)
		})

		it('makes the target bigger than the old fixed 120 pixels', () => {
			if (!layout) return
			expect(layout.target.width).toBeGreaterThan(120)
		})

		it('gives the same layout every time', () => {
			expect(packPuzzleStage(request)).toEqual(layout)
		})
	})
})

describe('stage layout limits', () => {
	const square = [
		{ x: 0, y: 0 },
		{ x: 100, y: 0 },
		{ x: 100, y: 100 },
		{ x: 0, y: 100 },
	]

	it('gives up when a piece cannot fit anywhere', () => {
		expect(
			packPuzzleStage({
				mode: 'landscape',
				width: 300,
				height: 200,
				board: { polygons: [square] },
				pieceRadii: [500],
			}),
		).toBeNull()
	})

	it('puts a lone piece beside a lone board, not on it', () => {
		const layout = packPuzzleStage({
			mode: 'portrait',
			width: 300,
			board: { polygons: [square] },
			pieceRadii: [20],
		})
		expect(layout).not.toBeNull()
		if (!layout) return
		const [piece] = layout.pieces
		const { board } = layout
		const overlaps =
			piece.x + piece.radius > board.x &&
			piece.x - piece.radius < board.x + board.width &&
			piece.y + piece.radius > board.y &&
			piece.y - piece.radius < board.y + board.height
		expect(overlaps).toBe(false)
	})
})

describe('piece radii', () => {
	it('reach at least as far as a piece does in any turn', () => {
		const shape: PuzzleShapeId = 'hexagon'
		const puzzle = largeRotationPuzzle(shape)
		const size = tileSizes[shape]
		const radii = puzzlePieceRadii(puzzle, size)
		const fixedRadii = puzzlePieceRadii(
			{ ...puzzle, rotationAllowed: false },
			size,
		)
		puzzle.pieces.forEach((piece, index) => {
			expect(radii[index]).toBeGreaterThanOrEqual(fixedRadii[index])
			for (let turn = 0; turn < 6; turn++) {
				const box = polygonBoundingBox([
					piece.tiles.flatMap(tile =>
						puzzleShapes[shape].corners(
							rotateCoordinate(tile, turn),
							size,
						),
					),
				])
				expect(
					Math.max(box.maxX - box.minX, box.maxY - box.minY) / 2,
				).toBeLessThanOrEqual(radii[index])
			}
		})
	})
})
