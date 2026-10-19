import type { Palette } from '@/domain/palettes'
import {
	generatePuzzle,
	type Puzzle,
	type PuzzleRecipe,
	type PuzzlePlacements,
} from './puzzle'
import type { PuzzleShapeId } from './puzzleShapes'

export interface AuthoringPalette extends Palette {
	readonly id: string
}

type ColorSlot = 0 | 1 | 2 | 3 | 4
const slotColors = [
	'#000000',
	'#000001',
	'#000002',
	'#000003',
	'#000004',
] as const

export const PUZZLE_GENERATOR_VERSIONS = {
	hexagon: 'hexagon-v2',
	triangle: 'triangle-v1',
} as const satisfies Record<PuzzleShapeId, string>

// Hexagon definitions predate other shapes and keep their `radius` key.
export type PuzzleGeometry =
	{ readonly radius: number } | { readonly size: number }

export function puzzleGeometry(
	shape: PuzzleShapeId,
	gridSize: number,
): PuzzleGeometry {
	return shape === 'hexagon' ? { radius: gridSize } : { size: gridSize }
}

export function geometryGridSize(geometry: PuzzleGeometry): number {
	return 'radius' in geometry ? geometry.radius : geometry.size
}

export interface PuzzleDefinition {
	readonly version: 2
	readonly geometry: PuzzleGeometry
	readonly target: Readonly<Record<string, ColorSlot>>
	readonly pieces: readonly {
		readonly id: string
		readonly tiles: readonly {
			readonly q: number
			readonly r: number
			readonly color_slot: ColorSlot
		}[]
	}[]
}

export interface AuthoredPuzzle {
	readonly shape: PuzzleShapeId
	readonly paletteId: string
	readonly recipe: PuzzleRecipe
	readonly seed: string
	readonly generatorVersion: (typeof PUZZLE_GENERATOR_VERSIONS)[PuzzleShapeId]
	readonly definition: PuzzleDefinition
	readonly knownSolution: PuzzlePlacements
}

function colorSlot(color: string): ColorSlot {
	const slot = slotColors.findIndex(value => value === color)
	if (slot !== 0 && slot !== 1 && slot !== 2 && slot !== 3 && slot !== 4) {
		throw new Error('Generated puzzle contains an invalid palette slot.')
	}
	return slot
}

export function generateAuthoredPuzzle(
	seed: string,
	paletteId: string,
	recipe: PuzzleRecipe,
	shape: PuzzleShapeId,
): AuthoredPuzzle {
	if (!paletteId.trim()) throw new Error('A palette ID is required.')
	const puzzle = generatePuzzle(
		seed,
		{ name: 'Slots', colors: slotColors },
		recipe,
		shape,
	)
	return {
		shape,
		paletteId,
		recipe,
		seed,
		generatorVersion: PUZZLE_GENERATOR_VERSIONS[shape],
		definition: {
			version: 2,
			geometry: puzzleGeometry(shape, puzzle.gridSize),
			target: Object.fromEntries(
				Object.entries(puzzle.target).map(([key, color]) => [
					key,
					colorSlot(color),
				]),
			),
			pieces: puzzle.pieces.map(piece => ({
				id: piece.id,
				tiles: piece.tiles.map(tile => ({
					q: tile.q,
					r: tile.r,
					color_slot: colorSlot(tile.color),
				})),
			})),
		},
		knownSolution: puzzle.solution,
	}
}

export function renderAuthoredPuzzle(
	authored: AuthoredPuzzle,
	palette: AuthoringPalette,
): Puzzle {
	if (palette.id !== authored.paletteId)
		throw new Error('The puzzle requires its assigned palette.')
	if (
		palette.colors.length !== 5 ||
		palette.colors.some(color => !/^#[0-9a-f]{6}$/i.test(color))
	) {
		throw new Error(
			'A puzzle requires a palette of five six-digit hex colors.',
		)
	}
	return {
		version: 1,
		shape: authored.shape,
		seed: authored.seed,
		gridSize: geometryGridSize(authored.definition.geometry),
		paletteName: palette.name,
		rotationAllowed: authored.recipe.rotation,
		target: Object.fromEntries(
			Object.entries(authored.definition.target).map(([key, slot]) => [
				key,
				palette.colors[slot],
			]),
		),
		pieces: authored.definition.pieces.map(piece => ({
			id: piece.id,
			tiles: piece.tiles.map(tile => ({
				q: tile.q,
				r: tile.r,
				color: palette.colors[tile.color_slot],
			})),
		})),
		solution: authored.knownSolution,
	}
}
