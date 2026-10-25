import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PlayerContent } from './playerContent'
import { PuzzleResumeContext, type PuzzleResume } from './PuzzleResumeContext'
import {
	hasProgress,
	loadResume,
	restoreAttempt,
	saveResume,
	type PuzzleAttempt,
	type ResumeState,
} from './puzzleResume'

function findPuzzle(content: PlayerContent, puzzleId: string) {
	for (const set of content.puzzleSets) {
		const item = set.puzzles.find(puzzle => puzzle.id === puzzleId)
		if (item) return { set, item }
	}
	return null
}

const sameAttempt = (a: PuzzleAttempt, b: PuzzleAttempt) =>
	JSON.stringify(a) === JSON.stringify(b)

// Keeps unfinished puzzles for one player on this device. Mount it with a `key` of the
// player so that a different player starts from their own.
export function PuzzleResumeProvider({
	userId,
	content,
	solved,
	children,
}: {
	readonly userId: string | null
	// What this player may play now; an attempt at anything else is ignored.
	readonly content: PlayerContent
	readonly solved: ReadonlySet<string>
	readonly children: ReactNode
}) {
	const [state, setState] = useState<ResumeState>(() => loadResume(userId))
	const stateRef = useRef(state)

	const commit = useCallback(
		(next: ResumeState) => {
			stateRef.current = next
			setState(next)
			saveResume(userId, next)
		},
		[userId],
	)

	const attemptFor = useCallback(
		(puzzleId: string): PuzzleAttempt | null => {
			const stored = state.attempts[puzzleId]
			const found = findPuzzle(content, puzzleId)
			if (!stored || !found || found.set.id !== stored.setId) return null
			return solved.has(puzzleId)
				? null
				: restoreAttempt(found.item.puzzle, stored)
		},
		[state, content, solved],
	)

	const clear = useCallback(
		(puzzleId: string) => {
			const { current, attempts } = stateRef.current
			if (!(puzzleId in attempts)) return
			const rest = { ...attempts }
			delete rest[puzzleId]
			commit({
				current: current === puzzleId ? null : current,
				attempts: rest,
			})
		},
		[commit],
	)

	const save = useCallback(
		(puzzleId: string, attempt: PuzzleAttempt) => {
			if (!hasProgress(attempt)) return clear(puzzleId)
			const { current, attempts } = stateRef.current
			if (
				current === puzzleId &&
				sameAttempt(attempts[puzzleId], attempt)
			)
				return
			// Attempts at puzzles already solved, perhaps on another device, are done with.
			const kept = Object.fromEntries(
				Object.entries(attempts).filter(
					([id]) => id !== puzzleId && !solved.has(id),
				),
			)
			commit({
				current: puzzleId,
				attempts: { ...kept, [puzzleId]: attempt },
			})
		},
		[clear, commit, solved],
	)

	const { current: currentId, attempts: stored } = state
	const target = useMemo(() => {
		const candidates = [
			...(currentId ? [currentId] : []),
			...Object.keys(stored)
				.filter(id => id !== currentId)
				.reverse(),
		]
		const id = candidates.find(candidate => attemptFor(candidate))
		return id ? { setId: stored[id].setId, puzzleId: id } : null
	}, [currentId, stored, attemptFor])

	const resume = useMemo<PuzzleResume>(
		() => ({ target, attemptFor, save, clear }),
		[target, attemptFor, save, clear],
	)
	return (
		<PuzzleResumeContext.Provider value={resume}>
			{children}
		</PuzzleResumeContext.Provider>
	)
}
