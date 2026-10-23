import type { PlayerContent } from './playerContent'

const STORAGE_KEY = 'kaleidoscope:content'
const STORAGE_VERSION = 1

// The last successful load, so a player who is offline still has something to play.
export function readCachedContent(): PlayerContent | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
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
			Array.isArray(content.puzzleSets)
			? (content as PlayerContent)
			: null
	} catch {
		return null
	}
}

export function cacheContent(content: PlayerContent): void {
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ version: STORAGE_VERSION, content }),
		)
	} catch {
		// A full or unavailable store only costs offline use.
	}
}
