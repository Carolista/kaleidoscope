import { describe, expect, it } from 'vitest'
import { palettes } from '@/test/playerContent'
import { generatePuzzle } from './puzzle'
import { nearestOpenAnchor, screenToBoard } from './puzzleSnap'
import { puzzleShapes } from './puzzleShapes'

const SIZE = 16

describe('screenToBoard', () => {
	it('undoes a scale and translation', () => {
		expect(
			screenToBoard(
				{ a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 },
				{ x: 14, y: 28 },
			),
		).toEqual({ x: 2, y: 4 })
	})
})

describe('nearestOpenAnchor', () => {
	const puzzle = generatePuzzle('placement', palettes[1])
	const single = puzzle.pieces.find(piece => piece.tiles.length === 1)!
	const other = puzzle.pieces.find(piece => piece.id !== single.id)!
	const offset = { q: 0, r: 0 }
	const solved = puzzle.solution[single.id]
	const pointerAtSolution = puzzleShapes.hexagon.center(solved, SIZE)

	function nearest(
		placements: Record<string, (typeof puzzle.solution)[string]>,
		pointer = pointerAtSolution,
	) {
		return nearestOpenAnchor({
			puzzle,
			placements,
			pieceId: single.id,
			rotation: 0,
			offset,
			pointer,
			size: SIZE,
		})
	}

	it('snaps to an open tile under the pointer', () => {
		expect(nearest({})).toEqual({ q: solved.q, r: solved.r })
	})

	it('pulls from within the tile plus the reach, but not from far away', () => {
		// Flat hexagons stack vertically, so a vertical offset reaches only this tile.
		const up = puzzleShapes.hexagon.center(
			{ q: solved.q, r: solved.r - 1 },
			SIZE,
		)
		const spacing = pointerAtSolution.y - up.y
		const at = (fraction: number) => ({
			...pointerAtSolution,
			y: pointerAtSolution.y + spacing * fraction,
		})
		const withReach = (pointer: { x: number; y: number }, reach: number) =>
			nearestOpenAnchor({
				puzzle,
				placements: {},
				pieceId: single.id,
				rotation: 0,
				offset,
				pointer,
				size: SIZE,
				reach,
			})
		expect(withReach(at(0.45), 0)).toEqual({ q: solved.q, r: solved.r })
		expect(withReach(at(3), 0.35)).toBeNull()
	})

	it('does not snap onto a tile another piece already covers', () => {
		const taken = { [other.id]: puzzle.solution[other.id] }
		const covered = puzzle.solution[other.id]
		const pointer = puzzleShapes.hexagon.center(covered, SIZE)
		expect(nearest(taken, pointer)).toBeNull()
	})

	it('ignores the held piece itself, so it can settle back where it was', () => {
		expect(nearest({ [single.id]: solved })).toEqual({
			q: solved.q,
			r: solved.r,
		})
	})
})
