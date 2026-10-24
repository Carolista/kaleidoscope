import { createContext, useContext } from 'react'
import type { NewRewards } from './rewards'

export interface PlayerProgress {
	// Puzzles this device has solved.
	readonly solved: ReadonlySet<string>
	// Records a solve and reports what it newly earned.
	readonly markSolved: (puzzleId: string) => NewRewards
}

export const PlayerProgressContext = createContext<PlayerProgress | null>(null)

export function usePlayerProgress(): PlayerProgress {
	const progress = useContext(PlayerProgressContext)
	if (!progress)
		throw new Error(
			'usePlayerProgress must be used within a PlayerProgressProvider',
		)
	return progress
}
