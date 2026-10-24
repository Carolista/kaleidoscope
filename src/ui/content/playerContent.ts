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

// A free group of puzzles; "group" is admin wording, so players see a set. A core
// set is open from the start; a bonus set is earned by completing a core set.
export interface PlayerPuzzleSet {
	readonly id: string
	readonly name: string
	readonly shape: GridShapeId
	readonly track: 'basic' | 'rotation'
	readonly kind: 'core' | 'bonus'
	readonly puzzles: readonly PlayerPuzzle[]
}

// What solving every puzzle in a set gives: palettes for Zen and bonus sets to play.
export interface PlayerReward {
	readonly setId: string
	readonly palettes: readonly PlayerPalette[]
	readonly bonusSetIds: readonly string[]
}

// Everything released that this player may read. The app uses it through
// `availableContent`, which keeps only what the player has earned.
export interface PlayerContent {
	// Zen's palettes, in the order the admin arranged them; once earned, reward palettes follow.
	readonly palettes: readonly PlayerPalette[]
	readonly unlockedShapes: readonly GridShapeId[]
	readonly puzzleSets: readonly PlayerPuzzleSet[]
	readonly rewards: readonly PlayerReward[]
}
