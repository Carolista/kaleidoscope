import { describe, expect, it } from 'vitest'
import { palettes } from '@/domain/palettes'
import { generateHexagonCells } from '@/domain/shapes/hexagon'
import {
	generateTriangleCells,
	triangleCorners,
} from '@/domain/shapes/triangle'
import {
	anchorAt,
	coordinateKey,
	generatePuzzle,
	getPuzzleColors,
	isPuzzleSolved,
	pieceCells,
	placePuzzlePiece,
	PUZZLE_RECIPES,
	rotateCoordinate,
} from './puzzle'
import type { PuzzlePlacements } from './puzzle'
import { puzzleShapes } from './puzzleShapes'

const palette = palettes[1]

describe('easy hex puzzle generation', () => {
	it('reproduces the complete definition for a seed and varies between seeds', () => {
		expect(generatePuzzle('cabo', palette)).toEqual(
			generatePuzzle('cabo', palette),
		)
		expect(generatePuzzle('cabo', palette)).not.toEqual(
			generatePuzzle('another', palette),
		)
	})

	it('produces a complete serializable definition for future set/pack authoring', () => {
		const puzzle = generatePuzzle('published-puzzle', palette)
		expect(JSON.parse(JSON.stringify(puzzle))).toEqual(puzzle)
		expect(puzzle).toMatchObject({
			version: 1,
			shape: 'hexagon',
			seed: 'published-puzzle',
			gridSize: 3,
			paletteName: 'Cabo',
		})
	})

	it.each(Array.from({ length: 100 }, (_, i) => `seed-${i}`))(
		'generates a solvable, connected, exact 1 + 2 + 3 partition for %s',
		seed => {
			const puzzle = generatePuzzle(seed, palette)
			const wedge = generateHexagonCells(puzzle.gridSize).filter(
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
						palette.colors.includes(tile.color),
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
		expect(() => generatePuzzle('', palette)).toThrow('seed')
		expect(() =>
			generatePuzzle('seed', {
				name: 'Invalid',
				colors: ['', '', '', '', ''],
			}),
		).toThrow('palette')
	})
})

describe('piece placement', () => {
	const puzzle = generatePuzzle('placement', palette)
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

describe('triangle puzzles', () => {
	const triangle = puzzleShapes.triangle
	const wedgeKeys = (gridSize: number) =>
		triangle
			.cells(gridSize)
			.filter(cell => cell.isClickable)
			.map(coordinateKey)
			.sort()

	const mod3 = (value: number) => ((value % 3) + 3) % 3
	const pointKey = ({ x, y }: { x: number; y: number }) =>
		`${Math.round(x * 1e6)},${Math.round(y * 1e6)}`

	it('maps every Zen triangle tile to a unique centroid with matching corners and edge neighbours', () => {
		for (const gridSize of Object.values(triangle.gridSizes)) {
			const cells = triangle.cells(gridSize)
			const zenCells = generateTriangleCells(gridSize)
			expect(new Set(cells.map(coordinateKey)).size).toBe(gridSize ** 2)
			cells.forEach((cell, index) => {
				expect(mod3(cell.q)).toBe(mod3(cell.r))
				expect(mod3(cell.q)).toBe(
					zenCells[index].direction === 'up' ? 2 : 1,
				)
				expect(triangle.corners(cell, 1).map(pointKey).sort()).toEqual(
					triangleCorners(zenCells[index], { size: 1 })
						.map(pointKey)
						.sort(),
				)
			})
			for (const a of cells) {
				const corners = new Set(triangle.corners(a, 1).map(pointKey))
				const touching = cells.filter(
					b =>
						triangle
							.corners(b, 1)
							.filter(point => corners.has(pointKey(point)))
							.length === 2,
				)
				expect(
					triangle
						.neighbors(a)
						.map(coordinateKey)
						.filter(key =>
							touching.some(b => coordinateKey(b) === key),
						)
						.sort(),
				).toEqual(touching.map(coordinateKey).sort())
			}
		}
		expect(
			Object.values(triangle.gridSizes).map(
				size => wedgeKeys(size).length,
			),
		).toEqual([5, 12, 22])
	})

	it('rotates tile offsets 60 degrees about their anchor vertex, flipping direction', () => {
		for (const cell of triangle.cells(4)) {
			const anchor = triangle.anchorFor(cell)
			expect([mod3(anchor.q), mod3(anchor.r)]).toEqual([0, 0])
			const offset = { q: cell.q - anchor.q, r: cell.r - anchor.r }
			const pivot = triangle.corners(cell, 1)[0]
			for (let rotation = 0; rotation < 6; rotation++) {
				const turned = rotateCoordinate(offset, rotation)
				const moved = { q: anchor.q + turned.q, r: anchor.r + turned.r }
				expect(mod3(moved.q)).toBe(
					rotation % 2 ? 3 - mod3(cell.q) : mod3(cell.q),
				)
				const center = triangle.center(moved, 1)
				const corners = triangle.corners(moved, 1)
				expect(center.x).toBeCloseTo(
					corners.reduce((sum, point) => sum + point.x, 0) / 3,
				)
				expect(center.y).toBeCloseTo(
					corners.reduce((sum, point) => sum + point.y, 0) / 3,
				)
				const angle = (rotation * Math.PI) / 3
				expect(triangle.corners(moved, 1).map(pointKey).sort()).toEqual(
					triangle
						.corners(cell, 1)
						.map(({ x, y }) => ({
							x:
								pivot.x +
								(x - pivot.x) * Math.cos(angle) -
								(y - pivot.y) * Math.sin(angle),
							y:
								pivot.y +
								(x - pivot.x) * Math.sin(angle) +
								(y - pivot.y) * Math.cos(angle),
						}))
						.map(pointKey)
						.sort(),
				)
			}
		}
	})

	it.each(
		PUZZLE_RECIPES.flatMap(recipe =>
			Array.from(
				{ length: 40 },
				(_, i) => [recipe.id, `t-${i}`, recipe] as const,
			),
		),
	)(
		'generates a solvable, connected %s partition for %s',
		(_, seed, recipe) => {
			const puzzle = generatePuzzle(seed, palette, recipe, 'triangle')
			expect(puzzle).toMatchObject({
				shape: 'triangle',
				gridSize: triangle.gridSizes[recipe.size],
			})
			expect(generatePuzzle(seed, palette, recipe, 'triangle')).toEqual(
				puzzle,
			)
			expect(Object.keys(puzzle.target).sort()).toEqual(
				wedgeKeys(puzzle.gridSize),
			)
			expect(puzzle.pieces.map(piece => piece.tiles.length)).toEqual(
				expect.arrayContaining([...triangle.pieceSizes[recipe.size]]),
			)
			expect(
				puzzle.pieces.map(piece => piece.tiles.length).sort(),
			).toEqual([...triangle.pieceSizes[recipe.size]].sort())
			let placements: PuzzlePlacements = {}
			for (const piece of puzzle.pieces) {
				const placement = puzzle.solution[piece.id]
				expect(Math.abs(placement.q % 3)).toBe(0)
				expect(Math.abs(placement.r % 3)).toBe(0)
				const cells = pieceCells(piece, placement)
				const keys = new Set(cells.map(coordinateKey))
				const reached = new Set([coordinateKey(cells[0])])
				for (let pass = 0; pass < cells.length; pass++)
					for (const cell of cells)
						if (
							triangle
								.neighbors(cell)
								.some(n => reached.has(coordinateKey(n)))
						)
							reached.add(coordinateKey(cell))
				expect([...reached].every(key => keys.has(key))).toBe(true)
				expect(reached.size).toBe(cells.length)
				const result = placePuzzlePiece(
					puzzle,
					placements,
					piece.id,
					placement,
				)
				if (!result.ok) throw new Error(result.reason)
				placements = result.placements
			}
			expect(isPuzzleSolved(puzzle, placements)).toBe(true)
		},
	)

	it('places a piece by its first tile, rejecting tiles that point the wrong way', () => {
		const puzzle = generatePuzzle(
			'anchor',
			palette,
			PUZZLE_RECIPES.find(recipe => recipe.id === 'hard-medium')!,
			'triangle',
		)
		const piece = puzzle.pieces.find(piece => piece.tiles.length > 1)!
		const solution = puzzle.solution[piece.id]
		const rotation = solution.rotation ?? 0
		const first = pieceCells(piece, solution)[0]
		expect(anchorAt(piece, first, rotation)).toEqual({
			q: solution.q,
			r: solution.r,
		})
		const flipped = {
			...anchorAt(piece, first, rotation + 1),
			rotation: rotation + 1,
		}
		expect(placePuzzlePiece(puzzle, {}, piece.id, flipped).ok).toBe(false)
	})
})
