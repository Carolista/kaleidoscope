// The app frame appears before the player's content has loaded, and is rebuilt
// once it has. This remembers how far the opening animation got, so the rebuilt
// frame continues it instead of playing it again.

const STAR_SPIN_MS = 2000
export const TITLE_MOVE_MS = 1400

let startedAt: number | null = null
let spinFinishedAt: number | null = null

export function markEntranceStarted() {
	startedAt ??= performance.now()
}

export function markEntranceSpinFinished() {
	spinFinishedAt ??= performance.now()
}

export interface EntranceHandoff {
	// The title has already finished moving into the header.
	readonly settled: boolean
	// The star has finished spinning, so the title has left the centre (and may still be moving).
	readonly spinDone: boolean
	// How long the star has been spinning, when the opening is still under way.
	readonly elapsedMs: number
	// How far into its move to the header the title got, once the spin is done.
	readonly moveElapsedMs: number
}

export function readEntranceHandoff(): EntranceHandoff {
	if (startedAt === null)
		return {
			settled: false,
			spinDone: false,
			elapsedMs: 0,
			moveElapsedMs: 0,
		}
	const now = performance.now()
	const spinEndedAt = spinFinishedAt ?? startedAt + STAR_SPIN_MS
	const moveElapsedMs = Math.max(0, now - spinEndedAt)
	return {
		settled: moveElapsedMs >= TITLE_MOVE_MS,
		spinDone: now >= spinEndedAt,
		elapsedMs: now - startedAt,
		moveElapsedMs,
	}
}

export function resetEntranceHandoff() {
	startedAt = null
	spinFinishedAt = null
}
