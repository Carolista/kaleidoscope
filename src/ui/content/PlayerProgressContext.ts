import { createContext, useContext } from 'react'
import type { NewRewards } from './rewards'

// The guest progress on this device that a signed-in player could bring into their account.
export interface GuestImport {
	// Puzzles solved as a guest that the account does not have yet.
	readonly count: number
	// True until the player has answered, so the offer opens by itself; after a "no" it
	// stays available only on request.
	readonly offered: boolean
	// Records the guest's solves on the account. The guest save itself is left as it is.
	// Resolves false when the server could not take them, so the player can try again.
	readonly run: () => Promise<boolean>
	readonly decline: () => void
}

export interface PlayerProgress {
	// Puzzles this player has solved: on this device for a guest, on the account when signed in.
	readonly solved: ReadonlySet<string>
	// Records a solve and reports what it newly earned. For an account, a solve that
	// finishes a set waits for the server so that what it unlocked can be reported.
	readonly markSolved: (puzzleId: string) => Promise<NewRewards>
	// Null for a guest, and when there is nothing (left) to import.
	readonly guestImport: GuestImport | null
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
