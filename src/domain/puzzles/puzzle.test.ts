import { describe, expect, it } from 'vitest'
import { palettes } from '@/test/playerContent'
import { generateHexagonCells } from '@/domain/shapes/hexagon'
import {
	generateTriangleCells,
	triangleCorners,
} from '@/domain/shapes/triangle'
import {
	diamondStarCellCorners,
	generateDiamondStarCells,
} from '@/domain/shapes/diamond-star'
import {
	generateHexagramCells,
	hexagramStarCellCorners,
} from '@/domain/shapes/hexagram'
import {
	circleRingsCellCenter,
	circleRingsCellRadius,
	generateCircleRingsCells,
} from '@/domain/shapes/circle-rings'
import {
	generatePinwheelCells,
	pinwheelCellCorners,
	PINWHEEL_GRID_SIZES,
} from '@/domain/shapes/pinwheel'
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
	unplaceableTiles,
} from './puzzle'
import type { PuzzlePlacements } from './puzzle'
import { pinwheelGridSize, puzzleShapes } from './puzzleShapes'

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

	it('lists the tiles that cannot land, ignoring the piece itself', () => {
		const placements = { [other.id]: puzzle.solution[other.id] }
		expect(
			unplaceableTiles(puzzle, placements, single.id, { q: 99, r: 99 }),
		).toEqual(new Set(['99,99']))
		expect(
			unplaceableTiles(
				puzzle,
				placements,
				single.id,
				puzzle.solution[other.id],
			).size,
		).toBe(1)
		expect(
			unplaceableTiles(
				puzzle,
				puzzle.solution,
				other.id,
				puzzle.solution[other.id],
			).size,
		).toBe(0)
		expect(
			unplaceableTiles(puzzle, {}, 'missing', { q: 0, r: 0 }).size,
		).toBe(0)
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
		).toEqual([7, 12, 22])
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

describe('diamond star puzzles', () => {
	const diamond = puzzleShapes.diamondStar
	const pointKey = ({ x, y }: { x: number; y: number }) =>
		`${Math.round(x * 1e6)},${Math.round(y * 1e6)}`
	const sharedCorners = (a: AxialCoordLike, b: AxialCoordLike) => {
		const corners = new Set(diamond.corners(a, 1).map(pointKey))
		return diamond
			.corners(b, 1)
			.filter(point => corners.has(pointKey(point))).length
	}
	type AxialCoordLike = { q: number; r: number; transform?: number }

	it('matches the Zen star tiles, with the wedge in the top point and edge neighbours', () => {
		for (const gridSize of Object.values(diamond.gridSizes)) {
			const cells = diamond.cells(gridSize)
			const zen = generateDiamondStarCells(gridSize)
			expect(
				new Set(
					cells.map(
						cell => `${cell.transform ?? 0}:${coordinateKey(cell)}`,
					),
				).size,
			).toBe(6 * gridSize ** 2)
			cells.forEach((cell, index) =>
				expect(diamond.corners(cell, 1).map(pointKey)).toEqual(
					diamondStarCellCorners(zen[index], {
						gridSize: 1,
						size: 1,
					}).map(pointKey),
				),
			)
			const wedge = cells.filter(cell => cell.isClickable)
			expect(wedge.every(cell => cell.transform === undefined)).toBe(true)
			for (const a of wedge)
				for (const b of wedge) {
					const isNeighbor = diamond
						.neighbors(a)
						.some(n => coordinateKey(n) === coordinateKey(b))
					expect(isNeighbor).toBe(sharedCorners(a, b) === 2)
				}
		}
		expect(
			Object.values(diamond.gridSizes).map(
				size =>
					diamond.cells(size).filter(cell => cell.isClickable).length,
			),
		).toEqual([6, 10, 15])
	})

	it('turns tiles 180 degrees about the anchor tile', () => {
		const anchor = { q: 2, r: 1 }
		const pivot = diamond.center(anchor, 1)
		for (const offset of [
			{ q: 1, r: 0 },
			{ q: 0, r: 1 },
			{ q: 2, r: -1 },
		]) {
			const turned = rotateCoordinate(offset, 3)
			expect(
				diamond
					.corners(
						{ q: anchor.q + turned.q, r: anchor.r + turned.r },
						1,
					)
					.map(pointKey)
					.sort(),
			).toEqual(
				diamond
					.corners(
						{ q: anchor.q + offset.q, r: anchor.r + offset.r },
						1,
					)
					.map(({ x, y }) => ({
						x: 2 * pivot.x - x,
						y: 2 * pivot.y - y,
					}))
					.map(pointKey)
					.sort(),
			)
		}
	})

	it.each(
		PUZZLE_RECIPES.flatMap(recipe =>
			Array.from(
				{ length: 30 },
				(_, i) => [recipe.id, `d-${i}`, recipe] as const,
			),
		),
	)(
		'generates a solvable, connected %s partition for %s',
		(_, seed, recipe) => {
			const puzzle = generatePuzzle(seed, palette, recipe, 'diamondStar')
			expect(puzzle).toMatchObject({
				shape: 'diamondStar',
				gridSize: diamond.gridSizes[recipe.size],
			})
			expect(
				puzzle.pieces.map(piece => piece.tiles.length).sort(),
			).toEqual([...diamond.pieceSizes[recipe.size]].sort())
			let placements: PuzzlePlacements = {}
			for (const piece of puzzle.pieces) {
				const placement = puzzle.solution[piece.id]
				expect([0, 3]).toContain(placement.rotation ?? 0)
				const cells = pieceCells(piece, placement)
				const reached = new Set([coordinateKey(cells[0])])
				for (let pass = 0; pass < cells.length; pass++)
					for (const cell of cells)
						if (
							diamond
								.neighbors(cell)
								.some(n => reached.has(coordinateKey(n)))
						)
							reached.add(coordinateKey(cell))
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

	it('rejects rotations other than half turns', () => {
		const puzzle = generatePuzzle(
			'half-turns',
			palette,
			PUZZLE_RECIPES.find(recipe => recipe.id === 'hard-medium')!,
			'diamondStar',
		)
		const piece = puzzle.pieces.find(piece => piece.tiles.length === 1)!
		const cell = Object.keys(puzzle.target)[0].split(',').map(Number)
		for (const rotation of [1, 2, 4, 5])
			expect(
				placePuzzlePiece(puzzle, {}, piece.id, {
					q: cell[0],
					r: cell[1],
					rotation,
				}),
			).toMatchObject({ ok: false })
		expect(
			placePuzzlePiece(puzzle, {}, piece.id, {
				q: cell[0],
				r: cell[1],
				rotation: 3,
			}).ok,
		).toBe(true)
	})
})

describe('hexagram puzzles', () => {
	const hexagram = puzzleShapes.hexagram
	const pointKey = ({ x, y }: { x: number; y: number }) =>
		`${Math.round(x * 1e6)},${Math.round(y * 1e6)}`

	it('maps every Zen hexagram tile to a unique lattice triangle with matching corners and edge neighbours', () => {
		for (const gridSize of Object.values(hexagram.gridSizes)) {
			const cells = hexagram.cells(gridSize)
			const zen = generateHexagramCells(gridSize)
			const keys = new Set(cells.map(coordinateKey))
			expect(keys.size).toBe(zen.length)
			cells.forEach((cell, index) =>
				expect(hexagram.corners(cell, 1).map(pointKey).sort()).toEqual(
					hexagramStarCellCorners(zen[index], { gridSize, size: 1 })
						.map(pointKey)
						.sort(),
				),
			)
			for (const a of cells) {
				const corners = new Set(hexagram.corners(a, 1).map(pointKey))
				const touching = cells
					.filter(
						b =>
							hexagram
								.corners(b, 1)
								.filter(point => corners.has(pointKey(point)))
								.length === 2,
					)
					.map(coordinateKey)
					.sort()
				expect(
					hexagram
						.neighbors(a)
						.map(coordinateKey)
						.filter(key => keys.has(key))
						.sort(),
				).toEqual(touching)
			}
		}
		expect(
			Object.values(hexagram.gridSizes).map(
				size =>
					hexagram.cells(size).filter(cell => cell.isClickable)
						.length,
			),
		).toEqual([6, 12, 20])
	})

	it.each(
		PUZZLE_RECIPES.flatMap(recipe =>
			Array.from(
				{ length: 30 },
				(_, i) => [recipe.id, `h-${i}`, recipe] as const,
			),
		),
	)(
		'generates a solvable, connected %s partition for %s',
		(_, seed, recipe) => {
			const puzzle = generatePuzzle(seed, palette, recipe, 'hexagram')
			expect(puzzle).toMatchObject({
				shape: 'hexagram',
				gridSize: hexagram.gridSizes[recipe.size],
			})
			expect(
				puzzle.pieces.map(piece => piece.tiles.length).sort(),
			).toEqual([...hexagram.pieceSizes[recipe.size]].sort())
			let placements: PuzzlePlacements = {}
			for (const piece of puzzle.pieces) {
				const placement = puzzle.solution[piece.id]
				const cells = pieceCells(piece, placement)
				const reached = new Set([coordinateKey(cells[0])])
				for (let pass = 0; pass < cells.length; pass++)
					for (const cell of cells)
						if (
							hexagram
								.neighbors(cell)
								.some(n => reached.has(coordinateKey(n)))
						)
							reached.add(coordinateKey(cell))
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
})

describe('circle rings puzzles', () => {
	const circles = puzzleShapes.circleRings
	const distance = (
		a: { x: number; y: number },
		b: { x: number; y: number },
	) => Math.hypot(a.x - b.x, a.y - b.y)

	it('maps every Zen circle to a unique hex cell at the same position, with touching circles as neighbours', () => {
		for (const gridSize of Object.values(circles.gridSizes)) {
			const cells = circles.cells(gridSize)
			const zen = generateCircleRingsCells(gridSize)
			const keys = new Set(cells.map(coordinateKey))
			expect(keys.size).toBe(zen.length)
			const layout = { ringCount: gridSize, size: 1 }
			cells.forEach((cell, index) => {
				const center = circleRingsCellCenter(zen[index], layout)
				expect(distance(circles.center(cell, 1), center)).toBeCloseTo(0)
				const radius = circleRingsCellRadius(zen[index], layout)
				for (const point of circles.corners(cell, 1))
					expect(distance(point, center)).toBeCloseTo(radius)
			})
			// Neighbours are always nearer, relative to their radii, than non-neighbours.
			const gap = (
				a: (typeof cells)[number],
				b: (typeof cells)[number],
			) => {
				const ra = distance(
					circles.corners(a, 1)[0],
					circles.center(a, 1),
				)
				const rb = distance(
					circles.corners(b, 1)[0],
					circles.center(b, 1),
				)
				return (
					distance(circles.center(a, 1), circles.center(b, 1)) /
					(ra + rb)
				)
			}
			let farthestNeighbour = 0
			let nearestOther = Infinity
			for (const a of cells) {
				const neighbours = new Set(
					circles.neighbors(a).map(coordinateKey),
				)
				for (const b of cells) {
					if (a === b) continue
					if (neighbours.has(coordinateKey(b)))
						farthestNeighbour = Math.max(
							farthestNeighbour,
							gap(a, b),
						)
					else nearestOther = Math.min(nearestOther, gap(a, b))
				}
			}
			expect(farthestNeighbour).toBeLessThan(nearestOther)
		}
		expect(
			Object.values(circles.gridSizes).map(
				size =>
					circles.cells(size).filter(cell => cell.isClickable).length,
			),
		).toEqual([6, 9, 12])
	})

	it('rotates positions 60 degrees about the center', () => {
		for (const cell of circles.cells(6)) {
			const turned = rotateCoordinate(cell, 1)
			const { x, y } = circles.center(cell, 1)
			const angle = Math.PI / 3
			const moved = circles.center(turned, 1)
			expect(moved.x).toBeCloseTo(
				x * Math.cos(angle) - y * Math.sin(angle),
			)
			expect(moved.y).toBeCloseTo(
				x * Math.sin(angle) + y * Math.cos(angle),
			)
		}
	})

	it.each(
		PUZZLE_RECIPES.flatMap(recipe =>
			Array.from(
				{ length: 30 },
				(_, i) => [recipe.id, `c-${i}`, recipe] as const,
			),
		),
	)('generates a solvable %s partition for %s', (_, seed, recipe) => {
		const puzzle = generatePuzzle(seed, palette, recipe, 'circleRings')
		expect(puzzle.pieces.map(piece => piece.tiles.length).sort()).toEqual(
			[...circles.pieceSizes[recipe.size]].sort(),
		)
		let placements: PuzzlePlacements = {}
		for (const piece of puzzle.pieces) {
			const result = placePuzzlePiece(
				puzzle,
				placements,
				piece.id,
				puzzle.solution[piece.id],
			)
			if (!result.ok) throw new Error(result.reason)
			placements = result.placements
		}
		expect(isPuzzleSolved(puzzle, placements)).toBe(true)
	})
})

describe('pinwheel puzzles', () => {
	const pinwheel = puzzleShapes.pinwheel
	const pointKey = ({ x, y }: { x: number; y: number }) =>
		`${Math.round(x * 1e6)},${Math.round(y * 1e6)}`

	it('matches the Zen spokes, with the whole top spoke as a 6/9/12-tile wedge and edge neighbours', () => {
		for (const [size, steps] of Object.entries(PINWHEEL_GRID_SIZES)) {
			const gridSize =
				pinwheel.gridSizes[size as keyof typeof pinwheel.gridSizes]
			const tiles = steps.rowSteps * steps.colSteps
			expect(gridSize).toBe(
				pinwheelGridSize(steps.rowSteps, steps.colSteps),
			)
			const cells = pinwheel.cells(gridSize)
			const zen = generatePinwheelCells(steps.rowSteps, steps.colSteps)
			expect(
				new Set(
					cells.map(
						cell => `${cell.transform ?? 0}:${coordinateKey(cell)}`,
					),
				).size,
			).toBe(8 * tiles)
			cells.forEach((cell, index) =>
				expect(pinwheel.corners(cell, 1).map(pointKey)).toEqual(
					pinwheelCellCorners(zen[index], { ...steps, size: 1 }).map(
						pointKey,
					),
				),
			)
			const wedge = cells.filter(cell => cell.isClickable)
			expect(wedge).toHaveLength(tiles)
			expect(wedge.every(cell => cell.transform === undefined)).toBe(true)
			for (const a of wedge) {
				const corners = new Set(pinwheel.corners(a, 1).map(pointKey))
				for (const b of wedge) {
					const shared = pinwheel
						.corners(b, 1)
						.filter(point => corners.has(pointKey(point))).length
					expect(
						pinwheel
							.neighbors(a)
							.some(n => coordinateKey(n) === coordinateKey(b)),
					).toBe(shared === 2)
				}
			}
		}
	})

	it('turns tiles 180 degrees about the anchor tile', () => {
		const anchor = { q: 1, r: 1 }
		const pivot = pinwheel.center(anchor, 1)
		for (const offset of [
			{ q: 1, r: 0 },
			{ q: 0, r: 1 },
			{ q: 1, r: -1 },
		]) {
			const turned = rotateCoordinate(offset, 3)
			expect(
				pinwheel
					.corners(
						{ q: anchor.q + turned.q, r: anchor.r + turned.r },
						1,
					)
					.map(pointKey)
					.sort(),
			).toEqual(
				pinwheel
					.corners(
						{ q: anchor.q + offset.q, r: anchor.r + offset.r },
						1,
					)
					.map(({ x, y }) => ({
						x: 2 * pivot.x - x,
						y: 2 * pivot.y - y,
					}))
					.map(pointKey)
					.sort(),
			)
		}
	})

	it.each(
		PUZZLE_RECIPES.flatMap(recipe =>
			Array.from(
				{ length: 30 },
				(_, i) => [recipe.id, `p-${i}`, recipe] as const,
			),
		),
	)(
		'generates a solvable, connected %s partition for %s',
		(_, seed, recipe) => {
			const puzzle = generatePuzzle(seed, palette, recipe, 'pinwheel')
			expect(puzzle.gridSize).toBe(pinwheel.gridSizes[recipe.size])
			expect(
				puzzle.pieces.map(piece => piece.tiles.length).sort(),
			).toEqual([...pinwheel.pieceSizes[recipe.size]].sort())
			let placements: PuzzlePlacements = {}
			for (const piece of puzzle.pieces) {
				const placement = puzzle.solution[piece.id]
				expect([0, 3]).toContain(placement.rotation ?? 0)
				const cells = pieceCells(piece, placement)
				const reached = new Set([coordinateKey(cells[0])])
				for (let pass = 0; pass < cells.length; pass++)
					for (const cell of cells)
						if (
							pinwheel
								.neighbors(cell)
								.some(n => reached.has(coordinateKey(n)))
						)
							reached.add(coordinateKey(cell))
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
})
