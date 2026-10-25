const STORAGE_KEY = 'kaleidoscope:account-prompt'

// The account prompt is offered once per device, whether or not it was acted on.
export function hasSeenAccountPrompt(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'seen'
	} catch {
		return false
	}
}

export function markAccountPromptSeen(): void {
	try {
		localStorage.setItem(STORAGE_KEY, 'seen')
	} catch {
		// Offering it again is better than crashing.
	}
}

const NUDGE_KEY = 'kaleidoscope:sign-in-nudge'

// The sign-in reminder runs at most once per browser session.
export function hasShownSignInNudge(): boolean {
	try {
		return sessionStorage.getItem(NUDGE_KEY) === 'shown'
	} catch {
		return false
	}
}

export function markSignInNudgeShown(): void {
	try {
		sessionStorage.setItem(NUDGE_KEY, 'shown')
	} catch {
		// Reminding again is better than crashing.
	}
}
