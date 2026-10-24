import type { PlayerPuzzleSet } from '@/ui/content'

export type IntroTrack = PlayerPuzzleSet['track']

const STORAGE_KEY = 'kaleidoscope:puzzle-intro'
const STORAGE_VERSION = 1
const TRACKS: readonly IntroTrack[] = ['basic', 'rotation']

// Which tutorials this device has completed. Guests keep this locally.
export function loadSeenIntros(): ReadonlySet<IntroTrack> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return new Set()
		const parsed: unknown = JSON.parse(raw)
		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			!('version' in parsed) ||
			parsed.version !== STORAGE_VERSION ||
			!('seen' in parsed) ||
			!Array.isArray(parsed.seen)
		)
			return new Set()
		return new Set(
			TRACKS.filter(track => (parsed.seen as unknown[]).includes(track)),
		)
	} catch {
		return new Set()
	}
}

export function saveSeenIntros(seen: ReadonlySet<IntroTrack>): void {
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ version: STORAGE_VERSION, seen: [...seen] }),
		)
	} catch {
		// Showing a tutorial again is better than crashing.
	}
}

// Players who already solved puzzles on this device, from before the tutorials
// existed, have learned the track and are not taught again.
export function needsIntro(
	track: IntroTrack,
	seen: ReadonlySet<IntroTrack>,
	sets: readonly PlayerPuzzleSet[],
	solved: ReadonlySet<string>,
): boolean {
	return (
		!seen.has(track) &&
		!sets.some(
			set =>
				set.track === track &&
				set.puzzles.some(puzzle => solved.has(puzzle.id)),
		)
	)
}
