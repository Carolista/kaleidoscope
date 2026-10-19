import type { Palette } from '@/domain/palettes'
import {
	generateHexPuzzle,
	type HexPuzzle,
	type HexPuzzleRecipe,
	type PuzzlePlacements,
} from './hexPuzzle'

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

export interface HexPuzzleDefinition {
	readonly version: 2
	readonly geometry: { readonly radius: number }
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

export interface AuthoredHexPuzzle {
	readonly paletteId: string
	readonly recipe: HexPuzzleRecipe
	readonly seed: string
	readonly generatorVersion: 'hexagon-v2'
	readonly definition: HexPuzzleDefinition
	readonly knownSolution: PuzzlePlacements
}

function colorSlot(color: string): ColorSlot {
	const slot = slotColors.findIndex(value => value === color)
	if (slot !== 0 && slot !== 1 && slot !== 2 && slot !== 3 && slot !== 4) {
		throw new Error('Generated puzzle contains an invalid palette slot.')
	}
	return slot
}

export function generateAuthoredHexPuzzle(
	seed: string,
	paletteId: string,
	recipe: HexPuzzleRecipe,
): AuthoredHexPuzzle {
	if (!paletteId.trim()) throw new Error('A palette ID is required.')
	const puzzle = generateHexPuzzle(
		seed,
		{ name: 'Slots', colors: slotColors },
		recipe,
	)
	return {
		paletteId,
		recipe,
		seed,
		generatorVersion: 'hexagon-v2',
		definition: {
			version: 2,
			geometry: { radius: puzzle.radius },
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

export function renderAuthoredHexPuzzle(
	authored: AuthoredHexPuzzle,
	palette: AuthoringPalette,
): HexPuzzle {
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
		shape: 'hexagon',
		seed: authored.seed,
		radius: authored.definition.geometry.radius,
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
