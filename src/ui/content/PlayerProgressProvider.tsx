import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { PlayerContent } from './playerContent'
import { PlayerContentContext } from './PlayerContentContext'
import { PlayerProgressContext } from './PlayerProgressContext'
import { availableContent, newRewards } from './rewards'
import type { NewRewards } from './rewards'
import { loadSolvedPuzzles, saveSolvedPuzzles } from './solvedPuzzles'

const NOTHING: NewRewards = { palettes: [], bonusSets: [] }

// Keeps the device's solved puzzles and offers the content they have earned,
// so every mode reads the same palettes and sets. Never merged into an account automatically.
export function PlayerProgressProvider({
	content,
	children,
}: {
	readonly content: PlayerContent
	readonly children: ReactNode
}) {
	const [solved, setSolved] = useState(loadSolvedPuzzles)
	const available = useMemo(
		() => availableContent(content, solved),
		[content, solved],
	)
	const markSolved = useCallback(
		(puzzleId: string) => {
			if (solved.has(puzzleId)) return NOTHING
			const next = new Set(solved).add(puzzleId)
			saveSolvedPuzzles(next)
			setSolved(next)
			return newRewards(content, solved, next)
		},
		[content, solved],
	)
	const progress = useMemo(
		() => ({ solved, markSolved }),
		[solved, markSolved],
	)
	return (
		<PlayerProgressContext.Provider value={progress}>
			<PlayerContentContext.Provider value={available}>
				{children}
			</PlayerContentContext.Provider>
		</PlayerProgressContext.Provider>
	)
}
