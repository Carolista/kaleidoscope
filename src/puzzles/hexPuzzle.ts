import type { ColorScheme } from '@appTypes/colorScheme'
import type { GridSize } from '@appTypes/gridSize'
import type { AxialCoord } from '@appTypes/hexagon'
import { generateHexagonCells, HEXAGON_GRID_RADII } from '@geometry/hexagonGrid'

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

export const HEX_PUZZLE_RECIPES = [
	{
		id: 'easy-small',
		label: 'EASY (S)',
		size: 'sm',
		rotation: false,
		difficulty: 'easy',
	},
	{
		id: 'moderate-small',
		label: 'MODERATE (S + rotation)',
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
		label: 'HARD (M + rotation)',
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
		label: 'SUPER HARD (L + rotation)',
		size: 'lg',
		rotation: true,
		difficulty: 'super_hard',
	},
] as const

export type HexPuzzleRecipe = (typeof HEX_PUZZLE_RECIPES)[number]

export interface HexPuzzle {
	readonly version: 1
	readonly shape: 'hexagon'
	readonly seed: string
	readonly radius: number
	readonly schemeName: string
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

const directions: readonly AxialCoord[] = [
	{ q: 1, r: 0 },
	{ q: 0, r: 1 },
	{ q: -1, r: 1 },
	{ q: -1, r: 0 },
	{ q: 0, r: -1 },
	{ q: 1, r: -1 },
]

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

function isConnected(cells: readonly AxialCoord[]): boolean {
	const remaining = new Set(cells.map(coordinateKey))
	const pending = [cells[0]]
	remaining.delete(coordinateKey(cells[0]))
	while (pending.length) {
		const cell = pending.pop()!
		for (const direction of directions) {
			const neighbor = {
				q: cell.q + direction.q,
				r: cell.r + direction.r,
			}
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
	cells: readonly AxialCoord[],
	sizes: readonly number[],
	random: () => number,
): AxialCoord[][] | null {
	if (sizes.length === 0) return cells.length === 0 ? [] : null
	for (const candidate of shuffle(combinations(cells, sizes[0]), random)) {
		if (!isConnected(candidate)) continue
		const keys = new Set(candidate.map(coordinateKey))
		const rest = partition(
			cells.filter(cell => !keys.has(coordinateKey(cell))),
			sizes.slice(1),
			random,
		)
		if (rest) return [candidate, ...rest]
	}
	return null
}

// Keep the original default recipe reproducible for the player POC.
export function generateHexPuzzle(
	seed: string,
	scheme: ColorScheme,
	recipe: {
		readonly size: GridSize
		readonly rotation: boolean
	} = HEX_PUZZLE_RECIPES[0],
): HexPuzzle {
	if (!seed.trim()) throw new Error('A puzzle seed is required.')
	if (
		scheme.colors.length !== 5 ||
		scheme.colors.some(color => !/^#[0-9a-f]{6}$/i.test(color))
	) {
		throw new Error(
			'A puzzle requires a palette of five six-digit hex colors.',
		)
	}
	const radius = HEXAGON_GRID_RADII[recipe.size]
	const cells = generateHexagonCells(radius).filter(cell => cell.isClickable)
	const random = seededRandom(seed)
	const sizes =
		recipe.size === 'sm'
			? [3, 2, 1]
			: recipe.size === 'md'
				? [3, 3, 2, 1]
				: [3, 3, 3, 3, 2, 1, 1]
	const groups = partition(cells, sizes, random)
	if (!groups) throw new Error('Unable to partition the hex puzzle wedge.')
	const target = Object.fromEntries(
		cells.map(cell => [
			cell.groupId,
			scheme.colors[Math.floor(random() * scheme.colors.length)],
		]),
	)
	const solution: Record<string, PuzzlePlacement> = {}
	const pieces = shuffle(groups, random).map((group, index) => {
		const id = `piece-${index + 1}`
		const anchor = group[0]
		const rotation = recipe.rotation ? Math.floor(random() * 6) : 0
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
		shape: 'hexagon',
		seed,
		radius,
		schemeName: scheme.name,
		target,
		pieces,
		solution,
		...(recipe.rotation ? { rotationAllowed: true } : {}),
	}
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
	puzzle: HexPuzzle,
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
	puzzle: HexPuzzle,
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
	puzzle: HexPuzzle,
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
