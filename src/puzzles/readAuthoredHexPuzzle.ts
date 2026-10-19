import type { Json, Tables } from '@/types/database'
import { HEX_PUZZLE_RECIPES, type PuzzlePlacement } from './hexPuzzle'
import type { AuthoredHexPuzzle, HexPuzzleDefinition } from './hexAuthoring'

function object(value: Json | undefined): { [key: string]: Json | undefined } {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Expected a puzzle object.')
	return value
}

function integer(value: Json | undefined): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value))
		throw new Error('Expected an integer puzzle coordinate.')
	return value
}

function slot(value: Json | undefined): 0 | 1 | 2 | 3 | 4 {
	if (value !== 0 && value !== 1 && value !== 2 && value !== 3 && value !== 4)
		throw new Error('Invalid puzzle palette slot.')
	return value
}

export function readHexPuzzleTarget(definition: Json): {
	readonly radius: number
	readonly target: HexPuzzleDefinition['target']
} {
	const source = object(definition)
	const radius = integer(object(source.geometry).radius)
	if (source.version !== 2 || ![3, 4, 6].includes(radius))
		throw new Error('Unsupported saved puzzle target.')
	const target = Object.fromEntries(
		Object.entries(object(source.target)).map(([key, value]) => {
			if (!/^-?\d+,-?\d+$/.test(key))
				throw new Error('Invalid puzzle target coordinate.')
			return [key, slot(value)]
		}),
	)
	if (!Object.keys(target).length)
		throw new Error('Saved puzzle has an empty target.')
	return { radius, target }
}

export function readAuthoredHexPuzzle(
	row: Tables<'puzzles'>,
	authoring: Tables<'puzzle_authoring'> | null,
): AuthoredHexPuzzle {
	const recipe = HEX_PUZZLE_RECIPES.find(
		value =>
			value.size === row.board_size &&
			value.rotation === row.rotation_allowed &&
			value.difficulty === row.difficulty,
	)
	if (row.shape_id !== 'hexagon' || !recipe || !authoring)
		throw new Error(
			`Puzzle "${row.name}" has missing or unsupported authoring data.`,
		)
	if (authoring.generator_version !== 'hexagon-v2')
		throw new Error(
			`Puzzle "${row.name}" uses an unsupported generator version.`,
		)
	const source = object(row.definition)
	const { radius, target } = readHexPuzzleTarget(row.definition)
	const expectedRadius = { sm: 3, md: 4, lg: 6 }[recipe.size]
	if (
		source.version !== 2 ||
		radius !== expectedRadius ||
		!Array.isArray(source.pieces)
	)
		throw new Error(`Puzzle "${row.name}" has an unsupported definition.`)
	const pieces: HexPuzzleDefinition['pieces'] = source.pieces.map(value => {
		const piece = object(value)
		if (
			typeof piece.id !== 'string' ||
			!piece.id ||
			!Array.isArray(piece.tiles) ||
			!piece.tiles.length
		)
			throw new Error('Invalid saved puzzle piece.')
		return {
			id: piece.id,
			tiles: piece.tiles.map(value => {
				const tile = object(value)
				return {
					q: integer(tile.q),
					r: integer(tile.r),
					color_slot: slot(tile.color_slot),
				}
			}),
		}
	})
	if (
		!pieces.length ||
		!Object.keys(target).length ||
		new Set(pieces.map(piece => piece.id)).size !== pieces.length
	)
		throw new Error('Saved puzzle has empty content or duplicate pieces.')
	const solution = object(authoring.known_solution)
	const knownSolution: Record<string, PuzzlePlacement> = {}
	for (const piece of pieces) {
		const placement = object(solution[piece.id])
		const rotation =
			placement.rotation === undefined ? 0 : integer(placement.rotation)
		if (
			rotation < 0 ||
			rotation > 5 ||
			(!recipe.rotation && rotation !== 0)
		)
			throw new Error('Invalid saved puzzle rotation.')
		knownSolution[piece.id] = {
			q: integer(placement.q),
			r: integer(placement.r),
			rotation,
		}
	}
	return {
		paletteId: row.palette_id,
		recipe,
		seed: authoring.seed,
		generatorVersion: 'hexagon-v2',
		definition: { version: 2, geometry: { radius }, target, pieces },
		knownSolution,
	}
}
