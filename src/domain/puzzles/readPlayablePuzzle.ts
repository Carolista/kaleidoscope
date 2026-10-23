import type { Tables } from '@/lib/supabase'
import type { Puzzle } from './puzzle'
import {
	PUZZLE_GENERATOR_VERSIONS,
	renderAuthoredPuzzle,
	type AuthoringPalette,
} from './puzzleAuthoring'
import { readPuzzleDefinition } from './readAuthoredPuzzle'

// A puzzle as a player gets it: rendered in its palette, with neither the
// generator seed nor the known solution, which only admins may read.
export function readPlayablePuzzle(
	row: Tables<'puzzles'>,
	palette: AuthoringPalette,
): Puzzle {
	const { shape, recipe, definition } = readPuzzleDefinition(row)
	return renderAuthoredPuzzle(
		{
			shape,
			paletteId: row.palette_id,
			recipe,
			seed: row.id,
			generatorVersion: PUZZLE_GENERATOR_VERSIONS[shape],
			definition,
			knownSolution: {},
		},
		palette,
	)
}
