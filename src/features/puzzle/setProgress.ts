import type { PlayerPuzzleSet } from '@/ui/content'

// The first puzzle after the current one that is not solved yet, wrapping
// around to earlier ones; null once every puzzle in the set is solved.
export function nextUnsolvedPuzzle(
	set: PlayerPuzzleSet,
	currentId: string,
	solved: ReadonlySet<string>,
) {
	const start = set.puzzles.findIndex(puzzle => puzzle.id === currentId)
	for (let offset = 1; offset <= set.puzzles.length; offset++) {
		const puzzle = set.puzzles[(start + offset) % set.puzzles.length]
		if (!solved.has(puzzle.id)) return puzzle
	}
	return null
}

export function solvedCount(
	set: PlayerPuzzleSet,
	solved: ReadonlySet<string>,
): number {
	return set.puzzles.filter(puzzle => solved.has(puzzle.id)).length
}
