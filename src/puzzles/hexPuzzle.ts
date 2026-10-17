import { generateHexagonCells, HEXAGON_GRID_RADII } from '@geometry/hexagonGrid'
import type { ColorScheme } from '@appTypes/colorScheme'
import type { AxialCoord } from '@appTypes/hexagon'

export interface PuzzleTile extends AxialCoord {
	readonly color: string
}

export interface PuzzlePiece {
	readonly id: string
	readonly tiles: readonly PuzzleTile[]
}

export type PuzzlePlacements = Readonly<Record<string, AxialCoord>>

export interface HexPuzzle {
	readonly version: 1
	readonly shape: 'hexagon'
	readonly seed: string
	readonly radius: number
	readonly schemeName: string
	readonly target: Readonly<Record<string, string>>
	readonly pieces: readonly PuzzlePiece[]
	readonly solution: PuzzlePlacements
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

// Version 1 fixes the easy recipe at six wedge tiles split into 3 + 2 + 1.
// Persist the definition, not just the seed, when publishing authored puzzles.
export function generateHexPuzzle(
	seed: string,
	scheme: ColorScheme,
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
	const radius = HEXAGON_GRID_RADII.sm
	const cells = generateHexagonCells(radius).filter(cell => cell.isClickable)
	if (cells.length !== 6) {
		throw new Error('The easy hex puzzle recipe requires six wedge tiles.')
	}
	const random = seededRandom(seed)
	const groups = partition(cells, [3, 2, 1], random)
	if (!groups) throw new Error('Unable to partition the hex puzzle wedge.')
	const target = Object.fromEntries(
		cells.map(cell => [
			cell.groupId,
			scheme.colors[Math.floor(random() * scheme.colors.length)],
		]),
	)
	const solution: Record<string, AxialCoord> = {}
	const pieces = shuffle(groups, random).map((group, index) => {
		const id = `piece-${index + 1}`
		const anchor = group[0]
		solution[id] = { q: anchor.q, r: anchor.r }
		return {
			id,
			tiles: group.map(cell => ({
				q: cell.q - anchor.q,
				r: cell.r - anchor.r,
				color: target[coordinateKey(cell)],
			})),
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
	}
}

export function pieceCells(
	piece: PuzzlePiece,
	anchor: AxialCoord,
): PuzzleTile[] {
	return piece.tiles.map(tile => ({
		q: anchor.q + tile.q,
		r: anchor.r + tile.r,
		color: tile.color,
	}))
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
	anchor: AxialCoord,
):
	| { readonly ok: true; readonly placements: PuzzlePlacements }
	| { readonly ok: false; readonly reason: string } {
	const piece = puzzle.pieces.find(piece => piece.id === pieceId)
	if (!piece) return { ok: false, reason: 'Choose a puzzle piece first.' }
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
