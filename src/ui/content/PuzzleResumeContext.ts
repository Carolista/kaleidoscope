import { createContext, useContext } from 'react'
import type { PuzzleAttempt } from './puzzleResume'

export interface ResumeTarget {
	readonly setId: string
	readonly puzzleId: string
}

// Unfinished puzzles on this device, so that a reload or a visit later picks up where
// the player left off. Never sent to the account: only results sync between devices.
export interface PuzzleResume {
	// The unfinished puzzle played most recently that is still open to this player.
	readonly target: ResumeTarget | null
	// What to put back on the board for a puzzle, rebuilt against the puzzle as published.
	readonly attemptFor: (puzzleId: string) => PuzzleAttempt | null
	// Remembers where the pieces are now. An empty board forgets the puzzle.
	readonly save: (puzzleId: string, attempt: PuzzleAttempt) => void
	readonly clear: (puzzleId: string) => void
}

export const PuzzleResumeContext = createContext<PuzzleResume | null>(null)

export function usePuzzleResume(): PuzzleResume {
	const resume = useContext(PuzzleResumeContext)
	if (!resume)
		throw new Error(
			'usePuzzleResume must be used within a PlayerProgressProvider',
		)
	return resume
}
