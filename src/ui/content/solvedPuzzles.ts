const STORAGE_KEY = 'kaleidoscope:puzzle-progress'
const STORAGE_VERSION = 1

function readIds(value: unknown): Set<string> {
	return new Set(
		Array.isArray(value)
			? value.filter(
					(id): id is string => typeof id === 'string' && id !== '',
				)
			: [],
	)
}

function readStored(key: string): Record<string, unknown> | null {
	try {
		const raw = localStorage.getItem(key)
		if (!raw) return null
		const parsed: unknown = JSON.parse(raw)
		return typeof parsed === 'object' &&
			parsed !== null &&
			'version' in parsed &&
			parsed.version === STORAGE_VERSION
			? (parsed as Record<string, unknown>)
			: null
	} catch {
		return null
	}
}

function writeStored(key: string, value: Record<string, unknown>): void {
	try {
		localStorage.setItem(
			key,
			JSON.stringify({ version: STORAGE_VERSION, ...value }),
		)
	} catch {
		// Losing progress to a full or unavailable store is not worth a crash.
	}
}

// Puzzles this device has solved. Guests keep this locally; it is never merged
// into an account automatically.
export function loadSolvedPuzzles(): ReadonlySet<string> {
	return readIds(readStored(STORAGE_KEY)?.solved)
}

export function saveSolvedPuzzles(solved: ReadonlySet<string>): void {
	writeStored(STORAGE_KEY, { solved: [...solved] })
}

// An account's copy of its progress, kept apart from the guest's. `pending` holds
// solves the server has not confirmed yet, so they survive a reload while offline.
export interface AccountProgressCache {
	readonly solved: ReadonlySet<string>
	readonly pending: ReadonlySet<string>
}

const accountKey = (userId: string) => `${STORAGE_KEY}:${userId}`

// What an account has done with this device's guest solves, by puzzle. `handled` were
// sent to the account (the server may have declined some, which is why they are
// remembered rather than offered again); `declined` were turned down for now, which
// only stops them opening the offer by themselves. Solves made as a guest afterwards
// are neither, so they are offered like any others.
export interface GuestImportState {
	readonly handled: ReadonlySet<string>
	readonly declined: ReadonlySet<string>
}

const importKey = (userId: string) => `kaleidoscope:guest-import:${userId}`

// An earlier version stored only 'imported' or 'declined' for the whole save. Those say
// nothing about which puzzles they covered, and reading them as covering whatever is on
// the device would swallow solves made later, so they are ignored: what was imported is
// already on the account, and anything else is simply offered again.
export function loadGuestImportState(userId: string): GuestImportState {
	const none = { handled: new Set<string>(), declined: new Set<string>() }
	try {
		const raw = localStorage.getItem(importKey(userId))
		if (!raw || raw === 'imported' || raw === 'declined') return none
		const parsed: unknown = JSON.parse(raw)
		if (typeof parsed !== 'object' || parsed === null) return none
		const stored = parsed as Record<string, unknown>
		return {
			handled: readIds(stored.handled),
			declined: readIds(stored.declined),
		}
	} catch {
		return none
	}
}

export function saveGuestImportState(
	userId: string,
	{ handled, declined }: GuestImportState,
): void {
	try {
		localStorage.setItem(
			importKey(userId),
			JSON.stringify({ handled: [...handled], declined: [...declined] }),
		)
	} catch {
		// Being asked again is better than crashing.
	}
}

export function loadAccountProgressCache(userId: string): AccountProgressCache {
	const stored = readStored(accountKey(userId))
	return {
		solved: readIds(stored?.solved),
		pending: readIds(stored?.pending),
	}
}

export function saveAccountProgressCache(
	userId: string,
	{ solved, pending }: AccountProgressCache,
): void {
	writeStored(accountKey(userId), {
		solved: [...solved],
		pending: [...pending],
	})
}
