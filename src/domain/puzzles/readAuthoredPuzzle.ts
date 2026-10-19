import type { Json, Tables } from '@/lib/supabase'
import { PUZZLE_RECIPES, type PuzzlePlacement } from './puzzle'
import {
	PUZZLE_GENERATOR_VERSIONS,
	puzzleGeometry,
	type AuthoredPuzzle,
	type PuzzleDefinition,
} from './puzzleAuthoring'
import {
	isPuzzleShapeId,
	puzzleShapes,
	type PuzzleShapeId,
} from './puzzleShapes'

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

export function readPuzzleTarget(
	shape: string,
	definition: Json,
): {
	readonly shape: PuzzleShapeId
	readonly gridSize: number
	readonly target: PuzzleDefinition['target']
} {
	if (!isPuzzleShapeId(shape))
		throw new Error('Unsupported saved puzzle shape.')
	const source = object(definition)
	const geometry = object(source.geometry)
	const [key] = Object.keys(puzzleGeometry(shape, 0))
	const gridSize = integer(geometry[key])
	if (
		source.version !== 2 ||
		Object.keys(geometry).length !== 1 ||
		!Object.values(puzzleShapes[shape].gridSizes).includes(gridSize)
	)
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
	return { shape, gridSize, target }
}

export function readAuthoredPuzzle(
	row: Tables<'puzzles'>,
	authoring: Tables<'puzzle_authoring'> | null,
): AuthoredPuzzle {
	const recipe = PUZZLE_RECIPES.find(
		value =>
			value.size === row.board_size &&
			value.rotation === row.rotation_allowed &&
			value.difficulty === row.difficulty,
	)
	const shape = row.shape_id
	if (!isPuzzleShapeId(shape) || !recipe || !authoring)
		throw new Error(
			`Puzzle "${row.name}" has missing or unsupported authoring data.`,
		)
	if (authoring.generator_version !== PUZZLE_GENERATOR_VERSIONS[shape])
		throw new Error(
			`Puzzle "${row.name}" uses an unsupported generator version.`,
		)
	const source = object(row.definition)
	const { gridSize, target } = readPuzzleTarget(shape, row.definition)
	if (
		source.version !== 2 ||
		gridSize !== puzzleShapes[shape].gridSizes[recipe.size] ||
		!Array.isArray(source.pieces)
	)
		throw new Error(`Puzzle "${row.name}" has an unsupported definition.`)
	const pieces: PuzzleDefinition['pieces'] = source.pieces.map(value => {
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
		shape,
		paletteId: row.palette_id,
		recipe,
		seed: authoring.seed,
		generatorVersion: PUZZLE_GENERATOR_VERSIONS[shape],
		definition: {
			version: 2,
			geometry: puzzleGeometry(shape, gridSize),
			target,
			pieces,
		},
		knownSolution,
	}
}
