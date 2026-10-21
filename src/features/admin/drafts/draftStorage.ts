// Browser-side safety net for unsaved admin work. Entries are scoped to the
// signed-in user, expire, and store only what is needed to rebuild a draft
// (never solutions). Storage errors (private mode, quota) are swallowed:
// losing the safety net must not break editing.
const PREFIX = 'kaleidoscope:admin-draft:'
const VERSION = 1
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface Envelope {
	readonly v: number
	readonly savedAt: number
	readonly data: unknown
}

function storageKey(userId: string, key: string) {
	return `${PREFIX}${userId}:${key}`
}

export function readDraft(userId: string, key: string): unknown {
	try {
		const name = storageKey(userId, key)
		const raw = localStorage.getItem(name)
		if (raw === null) return null
		const envelope = JSON.parse(raw) as Partial<Envelope> | null
		if (
			envelope?.v !== VERSION ||
			typeof envelope.savedAt !== 'number' ||
			Date.now() - envelope.savedAt > DRAFT_MAX_AGE_MS
		) {
			localStorage.removeItem(name)
			return null
		}
		return envelope.data ?? null
	} catch {
		return null
	}
}

export function writeDraft(userId: string, key: string, data: unknown) {
	try {
		const envelope: Envelope = { v: VERSION, savedAt: Date.now(), data }
		localStorage.setItem(storageKey(userId, key), JSON.stringify(envelope))
	} catch {
		// Losing the safety net isn't worth interrupting the editor.
	}
}

export function removeDraft(userId: string, key: string) {
	try {
		localStorage.removeItem(storageKey(userId, key))
	} catch {
		// See writeDraft.
	}
}

export function clearUserDrafts(userId: string) {
	try {
		const prefix = `${PREFIX}${userId}:`
		for (const name of Object.keys(localStorage))
			if (name.startsWith(prefix)) localStorage.removeItem(name)
	} catch {
		// See writeDraft.
	}
}
