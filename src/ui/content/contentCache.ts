import type { PlayerContent } from './playerContent'

const STORAGE_KEY = 'kaleidoscope:content'
const STORAGE_VERSION = 2

// Each account keeps its own copy, since what it may read differs from a guest's.
const storageKey = (userId: string | null) =>
	userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY

// The last successful load, so a player who is offline still has something to play.
export function readCachedContent(
	userId: string | null = null,
): PlayerContent | null {
	try {
		const raw = localStorage.getItem(storageKey(userId))
		if (!raw) return null
		const parsed: unknown = JSON.parse(raw)
		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			!('version' in parsed) ||
			parsed.version !== STORAGE_VERSION ||
			!('content' in parsed)
		)
			return null
		const content = parsed.content as Partial<PlayerContent> | null
		return content &&
			Array.isArray(content.palettes) &&
			Array.isArray(content.unlockedShapes) &&
			Array.isArray(content.puzzleSets) &&
			Array.isArray(content.rewards)
			? ({
					...content,
					nextShape: content.nextShape ?? null,
				} as PlayerContent)
			: null
	} catch {
		return null
	}
}

export function cacheContent(
	content: PlayerContent,
	userId: string | null = null,
): void {
	try {
		localStorage.setItem(
			storageKey(userId),
			JSON.stringify({ version: STORAGE_VERSION, content }),
		)
	} catch {
		// A full or unavailable store only costs offline use.
	}
}
