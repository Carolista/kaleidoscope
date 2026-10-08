// The two non-scheme colors always available to paint with: a light one and a dark one.
export interface ThemeColors {
	readonly base: string
	readonly accent: string
}

const LIGHT_MODE: ThemeColors = { base: '#ffffff', accent: '#222222' }
const DARK_MODE: ThemeColors = { base: '#222222', accent: '#ffffff' }

// Light mode is white with near-black accents (hexagons default to accent);
// dark mode is the reverse.
export function getThemeColors(darkMode: boolean): ThemeColors {
	return darkMode ? DARK_MODE : LIGHT_MODE
}
