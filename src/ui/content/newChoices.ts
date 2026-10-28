export interface SeenChoices {
	readonly palettes: ReadonlySet<string>
	readonly shapes: ReadonlySet<string>
}

const STORAGE_KEY = 'kaleidoscope:seen-choices'
const STORAGE_VERSION = 1

function keyFor(userId: string | null): string {
	return `${STORAGE_KEY}:${userId ?? 'guest'}`
}

function strings(value: unknown): Set<string> | null {
	return Array.isArray(value) && value.every(item => typeof item === 'string')
		? new Set(value)
		: null
}

// The palettes and shapes this player has already looked at in Zen's pickers, kept on
// this device for a guest or for each account. Null when nothing has been recorded.
export function loadSeenChoices(userId: string | null): SeenChoices | null {
	try {
		const raw = localStorage.getItem(keyFor(userId))
		if (!raw) return null
		const parsed: unknown = JSON.parse(raw)
		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			!('version' in parsed) ||
			parsed.version !== STORAGE_VERSION ||
			!('palettes' in parsed) ||
			!('shapes' in parsed)
		)
			return null
		const palettes = strings(parsed.palettes)
		const shapes = strings(parsed.shapes)
		return palettes && shapes ? { palettes, shapes } : null
	} catch {
		return null
	}
}

export function saveSeenChoices(
	userId: string | null,
	seen: SeenChoices,
): void {
	try {
		localStorage.setItem(
			keyFor(userId),
			JSON.stringify({
				version: STORAGE_VERSION,
				palettes: [...seen.palettes],
				shapes: [...seen.shapes],
			}),
		)
	} catch {
		// Showing a dot again is better than crashing.
	}
}

// What a player can choose from now that they have not looked at yet.
export function unseenChoices(
	palettes: readonly { readonly id: string }[],
	shapes: readonly string[],
	seen: SeenChoices,
): { readonly palettes: boolean; readonly shapes: boolean } {
	return {
		palettes: palettes.some(palette => !seen.palettes.has(palette.id)),
		shapes: shapes.some(shape => !seen.shapes.has(shape)),
	}
}
