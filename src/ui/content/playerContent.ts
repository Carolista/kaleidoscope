import type { PlayerPalette } from '@/domain/palettes'
import type { Puzzle, PuzzleDifficulty } from '@/domain/puzzles'
import type { GridShapeId } from '@/domain/shapes'

export interface PlayerPuzzle {
	readonly id: string
	readonly name: string
	readonly difficulty: PuzzleDifficulty
	readonly palette: PlayerPalette
	readonly puzzle: Puzzle
}

// A free core group of puzzles; "group" is admin wording, so players see a set.
export interface PlayerPuzzleSet {
	readonly id: string
	readonly name: string
	readonly shape: GridShapeId
	readonly track: 'basic' | 'rotation'
	readonly puzzles: readonly PlayerPuzzle[]
}

// Everything released that this player may use right now.
export interface PlayerContent {
	// Zen's palettes, in the order the admin arranged them.
	readonly palettes: readonly PlayerPalette[]
	readonly unlockedShapes: readonly GridShapeId[]
	readonly puzzleSets: readonly PlayerPuzzleSet[]
}
