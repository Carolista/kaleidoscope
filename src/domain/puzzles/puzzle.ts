import type { Palette } from '@/domain/palettes'
import type { GridSize } from '@/domain/shapes'
import type { AxialCoord } from '@/domain/shapes/hexagon'
import {
	puzzleShapes,
	type PuzzleShape,
	type PuzzleShapeId,
} from './puzzleShapes'

export interface PuzzleTile extends AxialCoord {
	readonly color: string
}

export interface PuzzlePiece {
	readonly id: string
	readonly tiles: readonly PuzzleTile[]
}

export interface PuzzlePlacement extends AxialCoord {
	readonly rotation?: number
}

export type PuzzlePlacements = Readonly<Record<string, PuzzlePlacement>>

export const PUZZLE_RECIPES = [
	{
		id: 'easy-small',
		label: 'EASY (S)',
		size: 'sm',
		rotation: false,
		difficulty: 'easy',
	},
	{
		id: 'moderate-small',
		label: 'MODERATE (S+)',
		size: 'sm',
		rotation: true,
		difficulty: 'moderate',
	},
	{
		id: 'moderate-medium',
		label: 'MODERATE (M)',
		size: 'md',
		rotation: false,
		difficulty: 'moderate',
	},
	{
		id: 'hard-medium',
		label: 'HARD (M+)',
		size: 'md',
		rotation: true,
		difficulty: 'hard',
	},
	{
		id: 'hard-large',
		label: 'HARD (L)',
		size: 'lg',
		rotation: false,
		difficulty: 'hard',
	},
	{
		id: 'super-hard-large',
		label: 'CHALLENGING (L+)',
		size: 'lg',
		rotation: true,
		difficulty: 'super_hard',
	},
] as const

export type PuzzleRecipe = (typeof PUZZLE_RECIPES)[number]
export type PuzzleDifficulty = PuzzleRecipe['difficulty']

export const PUZZLE_DIFFICULTY_LABELS: Record<PuzzleDifficulty, string> = {
	easy: 'Easy',
	moderate: 'Moderate',
	hard: 'Hard',
	super_hard: 'Challenging',
}
export interface Puzzle {
	readonly version: 1
	readonly shape: PuzzleShapeId
	readonly seed: string
	readonly gridSize: number
	readonly paletteName: string
	readonly target: Readonly<Record<string, string>>
	readonly pieces: readonly PuzzlePiece[]
	readonly solution: PuzzlePlacements
	readonly rotationAllowed?: boolean
}

export function rotateCoordinate<T extends AxialCoord>(
	cell: T,
	rotation: number,
): T {
	let { q, r } = cell
	for (let step = 0; step < ((rotation % 6) + 6) % 6; step++) {
		;[q, r] = [-r, q + r]
	}
	return { ...cell, q: q === 0 ? 0 : q, r: r === 0 ? 0 : r }
}

export function coordinateKey({ q, r }: AxialCoord): string {
	return `${q},${r}`
}

function seededRandom(seed: string): () => number {
	let state = 2166136261
	for (let i = 0; i < seed.length; i++) {
		state = Math.imul(state ^ seed.charCodeAt(i), 16777619)
	}
	return () => {
		state = (state + 0x6d2b79f5) | 0
		let value = Math.imul(state ^ (state >>> 15), state | 1)
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296
	}
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
	const result = [...items]
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1))
		;[result[i], result[j]] = [result[j], result[i]]
	}
	return result
}

function isConnected(
	shape: PuzzleShape,
	cells: readonly AxialCoord[],
): boolean {
	const remaining = new Set(cells.map(coordinateKey))
	const pending = [cells[0]]
	remaining.delete(coordinateKey(cells[0]))
	while (pending.length) {
		const cell = pending.pop()!
		for (const neighbor of shape.neighbors(cell)) {
			if (remaining.delete(coordinateKey(neighbor))) {
				pending.push(neighbor)
			}
		}
	}
	return remaining.size === 0
}

function combinations<T>(items: readonly T[], count: number): T[][] {
	if (count === 0) return [[]]
	return items.flatMap((item, index) =>
		combinations(items.slice(index + 1), count - 1).map(rest => [
			item,
			...rest,
		]),
	)
}

function partition(
	shape: PuzzleShape,
	cells: readonly AxialCoord[],
	sizes: readonly number[],
	random: () => number,
	budget?: { left: number },
): AxialCoord[][] | null {
	if (sizes.length === 0) return cells.length === 0 ? [] : null
	for (const candidate of shuffle(combinations(cells, sizes[0]), random)) {
		if (budget && --budget.left < 0)
			throw new Error('No arrangement of those pieces was found quickly.')
		if (!isConnected(shape, candidate)) continue
		const keys = new Set(candidate.map(coordinateKey))
		const rest = partition(
			shape,
			cells.filter(cell => !keys.has(coordinateKey(cell))),
			sizes.slice(1),
			random,
			budget,
		)
		if (rest) return [candidate, ...rest]
	}
	return null
}

// Overrides a shape's grid size and piece mix, for trying values out before
// they become the shape's defaults.
export interface PuzzleTuning {
	readonly gridSize?: number
	readonly pieceSizes?: readonly number[]
	// Gives up after this many candidate pieces, so untested mixes cannot hang.
	readonly attemptLimit?: number
}

// Keep the original default recipe reproducible for the player POC.
export function generatePuzzle(
	seed: string,
	palette: Palette,
	recipe: {
		readonly size: GridSize
		readonly rotation: boolean
	} = PUZZLE_RECIPES[0],
	shapeId: PuzzleShapeId = 'hexagon',
	tuning: PuzzleTuning = {},
): Puzzle {
	if (!seed.trim()) throw new Error('A puzzle seed is required.')
	if (
		palette.colors.length !== 5 ||
		palette.colors.some(color => !/^#[0-9a-f]{6}$/i.test(color))
	) {
		throw new Error(
			'A puzzle requires a palette of five six-digit hex colors.',
		)
	}
	const shape = puzzleShapes[shapeId]
	const gridSize = tuning.gridSize ?? shape.gridSizes[recipe.size]
	const cells = shape.cells(gridSize).filter(cell => cell.isClickable)
	const random = seededRandom(seed)
	const groups = partition(
		shape,
		cells,
		tuning.pieceSizes ?? shape.pieceSizes[recipe.size],
		random,
		tuning.attemptLimit === undefined
			? undefined
			: { left: tuning.attemptLimit },
	)
	if (!groups) throw new Error('Unable to partition the puzzle wedge.')
	const target = Object.fromEntries(
		cells.map(cell => [
			coordinateKey(cell),
			palette.colors[Math.floor(random() * palette.colors.length)],
		]),
	)
	const solution: Record<string, PuzzlePlacement> = {}
	const pieces = shuffle(groups, random).map((group, index) => {
		const id = `piece-${index + 1}`
		const anchor = shape.anchorFor(group[0])
		const step = shape.rotationStep
		const rotation = recipe.rotation
			? step * Math.floor(random() * (6 / step))
			: 0
		solution[id] = {
			q: anchor.q,
			r: anchor.r,
			...(recipe.rotation ? { rotation: (6 - rotation) % 6 } : {}),
		}
		return {
			id,
			tiles: group.map(cell =>
				rotateCoordinate(
					{
						q: cell.q - anchor.q,
						r: cell.r - anchor.r,
						color: target[coordinateKey(cell)],
					},
					rotation,
				),
			),
		}
	})
	return {
		version: 1,
		shape: shapeId,
		seed,
		gridSize,
		paletteName: palette.name,
		target,
		pieces,
		solution,
		...(recipe.rotation ? { rotationAllowed: true } : {}),
	}
}

// The anchor that puts the piece's first tile on `cell` at this rotation.
export function anchorAt(
	piece: PuzzlePiece,
	cell: AxialCoord,
	rotation = 0,
): AxialCoord {
	const first = rotateCoordinate(piece.tiles[0], rotation)
	return { q: cell.q - first.q, r: cell.r - first.r }
}

export function pieceCells(
	piece: PuzzlePiece,
	anchor: PuzzlePlacement,
): PuzzleTile[] {
	return piece.tiles.map(tile => {
		const rotated = rotateCoordinate(tile, anchor.rotation ?? 0)
		return { ...rotated, q: anchor.q + rotated.q, r: anchor.r + rotated.r }
	})
}

export function getPuzzleColors(
	puzzle: Puzzle,
	placements: PuzzlePlacements,
): Record<string, string> {
	return Object.fromEntries(
		puzzle.pieces.flatMap(piece => {
			const anchor = placements[piece.id]
			return anchor
				? pieceCells(piece, anchor).map(tile => [
						coordinateKey(tile),
						tile.color,
					])
				: []
		}),
	)
}

export function placePuzzlePiece(
	puzzle: Puzzle,
	placements: PuzzlePlacements,
	pieceId: string,
	anchor: PuzzlePlacement,
):
	| { readonly ok: true; readonly placements: PuzzlePlacements }
	| { readonly ok: false; readonly reason: string } {
	const piece = puzzle.pieces.find(piece => piece.id === pieceId)
	if (!piece) return { ok: false, reason: 'Choose a puzzle piece first.' }
	if (
		!Number.isInteger(anchor.q) ||
		!Number.isInteger(anchor.r) ||
		!Number.isInteger(anchor.rotation ?? 0) ||
		(anchor.rotation ?? 0) % puzzleShapes[puzzle.shape].rotationStep !==
			0 ||
		(!puzzle.rotationAllowed && (anchor.rotation ?? 0) !== 0)
	) {
		return {
			ok: false,
			reason: 'This placement has an invalid position or rotation.',
		}
	}
	const cells = pieceCells(piece, anchor)
	if (
		cells.some(cell => !Object.hasOwn(puzzle.target, coordinateKey(cell)))
	) {
		return {
			ok: false,
			reason: 'Keep every tile inside the outlined wedge.',
		}
	}
	const otherPlacements = { ...placements }
	delete otherPlacements[pieceId]
	const occupied = getPuzzleColors(puzzle, otherPlacements)
	if (cells.some(cell => Object.hasOwn(occupied, coordinateKey(cell)))) {
		return { ok: false, reason: 'That space overlaps another piece.' }
	}
	return { ok: true, placements: { ...placements, [pieceId]: { ...anchor } } }
}

export function isPuzzleSolved(
	puzzle: Puzzle,
	placements: PuzzlePlacements,
): boolean {
	const colors = getPuzzleColors(puzzle, placements)
	return (
		Object.keys(colors).length === Object.keys(puzzle.target).length &&
		Object.entries(puzzle.target).every(
			([id, color]) => colors[id] === color,
		)
	)
}
