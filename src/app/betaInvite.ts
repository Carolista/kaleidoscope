const STORAGE_KEY = 'kaleidoscope:beta-invite'
// A link that was never finished should not pull someone to the beta page weeks later.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const TOKEN = /^[A-Za-z0-9]{16,128}$/

interface StashedInvite {
	readonly token: string
	readonly at: number
}

// The token in an invite link, if the current address is one: #/beta?invite=…
function tokenFromHash(hash: string): string | null {
	const [route, query = ''] = hash.split('?')
	if (route !== '#/beta') return null
	const token = new URLSearchParams(query).get('invite')
	return token && TOKEN.test(token) ? token : null
}

// A signup confirmation email returns to the app root and drops the hash, and may open a
// new tab, so the token is kept on this device until the player has signed in to use it.
// The address is cleaned so the token is not left in the URL or the history.
export function captureBetaInvite(): void {
	const token = tokenFromHash(window.location.hash)
	if (!token) return
	try {
		const stashed: StashedInvite = { token, at: Date.now() }
		localStorage.setItem(STORAGE_KEY, JSON.stringify(stashed))
	} catch {
		// Without storage the link still works for a player who is already signed in.
	}
	window.history.replaceState(window.history.state, '', '#/beta')
}

export function readBetaInvite(): string | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return null
		const stashed: unknown = JSON.parse(raw)
		if (
			stashed &&
			typeof stashed === 'object' &&
			'token' in stashed &&
			typeof stashed.token === 'string' &&
			TOKEN.test(stashed.token) &&
			'at' in stashed &&
			typeof stashed.at === 'number' &&
			Date.now() - stashed.at < MAX_AGE_MS
		)
			return stashed.token
		clearBetaInvite()
	} catch {
		// Unreadable storage means there is no invite to use.
	}
	return null
}

export function clearBetaInvite(): void {
	try {
		localStorage.removeItem(STORAGE_KEY)
	} catch {
		// Nothing to clear.
	}
}
