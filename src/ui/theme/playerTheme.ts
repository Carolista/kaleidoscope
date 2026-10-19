import { createContext, useContext } from 'react'
import type { Palette } from '@/domain/palettes'

// The player-wide look that shared player UI needs (icon tint, theme toggle),
// without depending on any one mode's state. Zen's state provider supplies it.
export interface PlayerTheme {
	readonly darkMode: boolean
	readonly palette: Palette
	readonly toggleDarkMode: () => void
}

export const PlayerThemeContext = createContext<PlayerTheme | null>(null)

export function usePlayerTheme(): PlayerTheme {
	const theme = useContext(PlayerThemeContext)
	if (!theme)
		throw new Error(
			'usePlayerTheme must be used within a player theme provider',
		)
	return theme
}
