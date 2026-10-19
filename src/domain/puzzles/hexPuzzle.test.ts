import { describe, expect, it } from 'vitest'
import { colorSchemes } from '@/data/colorSchemes'
import { generateHexagonCells } from '@/domain/shapes/hexagon'
import {
	coordinateKey,
	generateHexPuzzle,
	getPuzzleColors,
	isPuzzleSolved,
	pieceCells,
	placePuzzlePiece,
} from './hexPuzzle'
import type { PuzzlePlacements } from './hexPuzzle'

const scheme = colorSchemes[1]

describe('easy hex puzzle generation', () => {
	it('reproduces the complete definition for a seed and varies between seeds', () => {
		expect(generateHexPuzzle('cabo', scheme)).toEqual(
			generateHexPuzzle('cabo', scheme),
		)
		expect(generateHexPuzzle('cabo', scheme)).not.toEqual(
			generateHexPuzzle('another', scheme),
		)
	})

	it('produces a complete serializable definition for future set/pack authoring', () => {
		const puzzle = generateHexPuzzle('published-puzzle', scheme)
		expect(JSON.parse(JSON.stringify(puzzle))).toEqual(puzzle)
		expect(puzzle).toMatchObject({
			version: 1,
			shape: 'hexagon',
			seed: 'published-puzzle',
			radius: 3,
			schemeName: 'Cabo',
		})
	})

	it.each(Array.from({ length: 100 }, (_, i) => `seed-${i}`))(
		'generates a solvable, connected, exact 1 + 2 + 3 partition for %s',
		seed => {
			const puzzle = generateHexPuzzle(seed, scheme)
			const wedge = generateHexagonCells(puzzle.radius).filter(
				cell => cell.isClickable,
			)
			expect(wedge).toHaveLength(6)
			expect(
				puzzle.pieces.map(piece => piece.tiles.length).sort(),
			).toEqual([1, 2, 3])
			const covered = puzzle.pieces.flatMap(piece =>
				pieceCells(piece, puzzle.solution[piece.id]).map(coordinateKey),
			)
			expect(covered.sort()).toEqual(wedge.map(coordinateKey).sort())
			let placements: PuzzlePlacements = {}
			for (const piece of puzzle.pieces) {
				const reached = new Set([0])
				for (let pass = 0; pass < piece.tiles.length; pass++) {
					piece.tiles.forEach((a, i) => {
						if (
							piece.tiles.some((b, j) => {
								const dq = a.q - b.q
								const dr = a.r - b.r
								return (
									reached.has(j) &&
									Math.max(
										Math.abs(dq),
										Math.abs(dr),
										Math.abs(dq + dr),
									) === 1
								)
							})
						)
							reached.add(i)
					})
				}
				expect(reached.size).toBe(piece.tiles.length)
				expect(
					piece.tiles.every(tile =>
						scheme.colors.includes(tile.color),
					),
				).toBe(true)
				expect(piece.tiles[0]).toMatchObject({ q: 0, r: 0 })
				const result = placePuzzlePiece(
					puzzle,
					placements,
					piece.id,
					puzzle.solution[piece.id],
				)
				expect(result.ok).toBe(true)
				if (!result.ok) throw new Error(result.reason)
				placements = result.placements
			}
			expect(getPuzzleColors(puzzle, placements)).toEqual(puzzle.target)
			expect(isPuzzleSolved(puzzle, placements)).toBe(true)
			expect(isPuzzleSolved(puzzle, {})).toBe(false)
		},
	)

	it('rejects invalid generation inputs explicitly', () => {
		expect(() => generateHexPuzzle('', scheme)).toThrow('seed')
		expect(() =>
			generateHexPuzzle('seed', {
				name: 'Invalid',
				colors: ['', '', '', '', ''],
			}),
		).toThrow('palette')
	})
})

describe('piece placement', () => {
	const puzzle = generateHexPuzzle('placement', scheme)
	const single = puzzle.pieces.find(piece => piece.tiles.length === 1)!
	const other = puzzle.pieces.find(piece => piece.tiles.length > 1)!

	it('rejects outside-wedge and overlapping drops without mutating placements', () => {
		const placements = { [other.id]: puzzle.solution[other.id] }
		expect(
			placePuzzlePiece(puzzle, placements, single.id, { q: 99, r: 99 })
				.ok,
		).toBe(false)
		expect(
			placePuzzlePiece(
				puzzle,
				placements,
				single.id,
				puzzle.solution[other.id],
			).ok,
		).toBe(false)
		expect(placements).toEqual({ [other.id]: puzzle.solution[other.id] })
		expect(placePuzzlePiece(puzzle, {}, 'missing', { q: 0, r: 0 }).ok).toBe(
			false,
		)
	})

	it('accepts an incorrect but fitting placement, and can move an existing piece', () => {
		const wrong = puzzle.solution[other.id]
		const result = placePuzzlePiece(puzzle, {}, single.id, wrong)
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error(result.reason)
		expect(isPuzzleSolved(puzzle, result.placements)).toBe(false)
		const moved = placePuzzlePiece(
			puzzle,
			result.placements,
			single.id,
			puzzle.solution[single.id],
		)
		expect(moved).toEqual({
			ok: true,
			placements: { [single.id]: puzzle.solution[single.id] },
		})
		expect(
			placePuzzlePiece(
				puzzle,
				puzzle.solution,
				single.id,
				puzzle.solution[single.id],
			).ok,
		).toBe(true)
	})

	it('does not accept a full board whose colors differ from the target', () => {
		const altered = {
			...puzzle,
			target: {
				...puzzle.target,
				[coordinateKey(puzzle.solution[single.id])]: '#000000',
			},
		}
		expect(isPuzzleSolved(altered, puzzle.solution)).toBe(false)
	})
})
