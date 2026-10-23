import type { PlayerPuzzle, PlayerPuzzleSet } from '@/ui/content'

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
	puzzles: readonly PlayerPuzzle[],
	solved: ReadonlySet<string>,
): number {
	return puzzles.filter(puzzle => solved.has(puzzle.id)).length
}

export interface DifficultySection {
	readonly difficulty: PlayerPuzzle['difficulty']
	readonly puzzles: readonly {
		readonly item: PlayerPuzzle
		// Position within the whole set, starting at 1.
		readonly number: number
	}[]
}

// A set's puzzles split by difficulty, in the order each difficulty first appears.
export function difficultySections(
	set: PlayerPuzzleSet,
): readonly DifficultySection[] {
	const sections = new Map<
		PlayerPuzzle['difficulty'],
		DifficultySection['puzzles'][number][]
	>()
	set.puzzles.forEach((item, index) => {
		const list = sections.get(item.difficulty) ?? []
		list.push({ item, number: index + 1 })
		sections.set(item.difficulty, list)
	})
	return [...sections].map(([difficulty, puzzles]) => ({
		difficulty,
		puzzles,
	}))
}
