import { describe, expect, it } from 'vitest'
import { generateHexagonCells } from '@/domain/shapes/hexagon'
import {
	PUZZLE_RECIPES,
	coordinateKey,
	isPuzzleSolved,
	pieceCells,
	placePuzzlePiece,
	rotateCoordinate,
	type PuzzlePlacements,
} from './puzzle'
import {
	generateAuthoredHexPuzzle,
	renderAuthoredHexPuzzle,
} from './hexAuthoring'

const palette = {
	id: 'test',
	name: 'Duplicate colors',
	colors: ['#112233', '#112233', '#445566', '#778899', '#aabbcc'] as const,
}

describe.each(PUZZLE_RECIPES)('$label', recipe => {
	it.each(Array.from({ length: 30 }, (_, i) => `recipe-${i}`))(
		'generates a connected, solvable exact cover for %s',
		seed => {
			const authored = generateAuthoredHexPuzzle(seed, palette.id, recipe)
			expect(generateAuthoredHexPuzzle(seed, palette.id, recipe)).toEqual(
				authored,
			)
			expect(JSON.parse(JSON.stringify(authored))).toEqual(authored)
			expect(Object.keys(authored.definition).sort()).toEqual([
				'geometry',
				'pieces',
				'target',
				'version',
			])
			expect(
				Object.values(authored.definition.target).every(
					slot => Number.isInteger(slot) && slot >= 0 && slot < 5,
				),
			).toBe(true)
			const puzzle = renderAuthoredHexPuzzle(authored, palette)
			for (const piece of authored.definition.pieces) {
				const placement = authored.knownSolution[piece.id]
				for (const tile of piece.tiles) {
					const rotated = rotateCoordinate(
						tile,
						placement.rotation ?? 0,
					)
					const key = coordinateKey({
						q: placement.q + rotated.q,
						r: placement.r + rotated.r,
					})
					expect(authored.definition.target[key]).toBe(
						tile.color_slot,
					)
				}
			}
			const wedge = generateHexagonCells(puzzle.gridSize).filter(
				cell => cell.isClickable,
			)
			expect(wedge.length).toBe(
				recipe.size === 'sm' ? 6 : recipe.size === 'md' ? 9 : 16,
			)
			const covered = puzzle.pieces.flatMap(piece =>
				pieceCells(piece, puzzle.solution[piece.id]).map(coordinateKey),
			)
			expect(covered.sort()).toEqual(wedge.map(coordinateKey).sort())
			let placements: PuzzlePlacements = {}
			for (const piece of puzzle.pieces) {
				const reached = new Set([coordinateKey(piece.tiles[0])])
				for (let pass = 0; pass < piece.tiles.length; pass++) {
					for (const a of piece.tiles) {
						if (
							piece.tiles.some(
								b =>
									reached.has(coordinateKey(b)) &&
									Math.max(
										Math.abs(a.q - b.q),
										Math.abs(a.r - b.r),
										Math.abs(a.q + a.r - b.q - b.r),
									) === 1,
							)
						)
							reached.add(coordinateKey(a))
					}
				}
				expect(reached.size).toBe(piece.tiles.length)
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
			expect(isPuzzleSolved(puzzle, {})).toBe(false)
		},
	)

	it('varies with the seed and rejects out-of-wedge and overlapping placements', () => {
		const authored = generateAuthoredHexPuzzle(
			'placement',
			palette.id,
			recipe,
		)
		expect(
			generateAuthoredHexPuzzle('different', palette.id, recipe)
				.definition,
		).not.toEqual(authored.definition)
		const puzzle = renderAuthoredHexPuzzle(authored, palette)
		const first = puzzle.pieces.find(piece => piece.tiles.length > 1)!
		const other = puzzle.pieces.find(piece => piece.tiles.length === 1)!
		const placements = { [first.id]: puzzle.solution[first.id] }
		const before = JSON.stringify(placements)
		expect(
			placePuzzlePiece(puzzle, placements, other.id, { q: 99, r: 99 }).ok,
		).toBe(false)
		const anchor = puzzle.solution[first.id]
		expect(
			placePuzzlePiece(puzzle, placements, other.id, {
				q: anchor.q,
				r: anchor.r,
			}),
		).toMatchObject({
			ok: false,
			reason: 'That space overlaps another piece.',
		})
		expect(JSON.stringify(placements)).toBe(before)
	})
})

it('retains palette slot identity through corrections, even with duplicate colors', () => {
	const authored = generateAuthoredHexPuzzle(
		'slots',
		palette.id,
		PUZZLE_RECIPES[0],
	)
	const corrected = {
		...palette,
		colors: [
			'#abcdef',
			'#fedcba',
			'#445566',
			'#778899',
			'#aabbcc',
		] as const,
	}
	const rendered = renderAuthoredHexPuzzle(authored, corrected)
	for (const [key, slot] of Object.entries(authored.definition.target)) {
		expect(rendered.target[key]).toBe(corrected.colors[slot])
	}
	expect(isPuzzleSolved(rendered, rendered.solution)).toBe(true)
	expect(() =>
		renderAuthoredHexPuzzle(authored, { ...palette, id: 'wrong' }),
	).toThrow('assigned palette')
})

it('rotates axial coordinates exactly and rejects invalid placement rotations', () => {
	const cell = { q: 2, r: -1, color: '#123456' }
	expect(rotateCoordinate(cell, 6)).toEqual(cell)
	expect(rotateCoordinate(rotateCoordinate(cell, 1), -1)).toEqual(cell)
	const noRotation = renderAuthoredHexPuzzle(
		generateAuthoredHexPuzzle('rotations', palette.id, PUZZLE_RECIPES[0]),
		palette,
	)
	expect(
		placePuzzlePiece(noRotation, {}, noRotation.pieces[0].id, {
			q: 0,
			r: 0,
			rotation: 1,
		}).ok,
	).toBe(false)
	const rotation = renderAuthoredHexPuzzle(
		generateAuthoredHexPuzzle(
			'rotations',
			palette.id,
			PUZZLE_RECIPES.find(recipe => recipe.id === 'moderate-small')!,
		),
		palette,
	)
	expect(
		placePuzzlePiece(rotation, {}, rotation.pieces[0].id, {
			q: 0,
			r: 0,
			rotation: NaN,
		}).ok,
	).toBe(false)
})
