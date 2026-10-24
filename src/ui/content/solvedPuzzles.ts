const STORAGE_KEY = 'kaleidoscope:puzzle-progress'
const STORAGE_VERSION = 1

// Puzzles this device has solved. Guests keep this locally; it is never merged
// into an account automatically.
export function loadSolvedPuzzles(): ReadonlySet<string> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return new Set()
		const parsed: unknown = JSON.parse(raw)
		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			!('version' in parsed) ||
			parsed.version !== STORAGE_VERSION ||
			!('solved' in parsed) ||
			!Array.isArray(parsed.solved)
		)
			return new Set()
		return new Set(
			parsed.solved.filter(
				(id): id is string => typeof id === 'string' && id !== '',
			),
		)
	} catch {
		return new Set()
	}
}

export function saveSolvedPuzzles(solved: ReadonlySet<string>): void {
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ version: STORAGE_VERSION, solved: [...solved] }),
		)
	} catch {
		// Losing progress to a full or unavailable store is not worth a crash.
	}
}
