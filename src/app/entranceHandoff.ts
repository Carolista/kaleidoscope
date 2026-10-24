// The app frame appears before the player's content has loaded, and is rebuilt
// once it has. This remembers how far the opening animation got, so the rebuilt
// frame continues it instead of playing it again.

const STAR_SPIN_MS = 2000

let startedAt: number | null = null
let spinFinished = false

export function markEntranceStarted() {
	startedAt ??= performance.now()
}

export function markEntranceSpinFinished() {
	spinFinished = true
}

export interface EntranceHandoff {
	// The opening is already past the point where the title leaves the centre.
	readonly settled: boolean
	// How long the star has been spinning, when the opening is still under way.
	readonly elapsedMs: number
}

export function readEntranceHandoff(): EntranceHandoff {
	if (startedAt === null) return { settled: false, elapsedMs: 0 }
	const elapsedMs = performance.now() - startedAt
	return {
		settled: spinFinished || elapsedMs >= STAR_SPIN_MS,
		elapsedMs,
	}
}

export function resetEntranceHandoff() {
	startedAt = null
	spinFinished = false
}
