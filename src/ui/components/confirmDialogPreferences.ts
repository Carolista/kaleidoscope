// Persists "don't show this again" choices for individual ConfirmDialog
// call sites, each identified by its own `key` (e.g. 'reset-design'), so
// dismissing one confirmation (like resetting the design) has no effect on
// any other (like switching grid shape). Mirrors storageService's pattern
// of swallowing storage errors (e.g. disabled localStorage in a private
// browsing mode) rather than letting them crash the app.
const KEY_PREFIX = 'kaleidoscope:skipConfirm:'

export function isConfirmDialogDismissed(key: string): boolean {
	try {
		return localStorage.getItem(KEY_PREFIX + key) === 'true'
	} catch {
		return false
	}
}

export function dismissConfirmDialog(key: string): void {
	try {
		localStorage.setItem(KEY_PREFIX + key, 'true')
	} catch {
		// Losing this preference isn't worth crashing the app over.
	}
}
