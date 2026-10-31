import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { readPersistedDarkMode, saveThemePreference } from '@/features/zen'
import type { PlayerTheme } from '@/ui/theme'
import { PlayerThemeContext } from '@/ui/theme'
import { NEUTRAL_PALETTE } from './neutralPalette'

// The theme for the beta page, which has no player content: the saved light or dark mode, a
// neutral palette, and a toggle. The mode is saved on its own, as the player pages save it,
// so they open in the mode chosen here whether or not a design has been saved yet.
export default function BetaTheme({
	children,
}: {
	readonly children: ReactNode
}) {
	const [darkMode, setDarkMode] = useState(readPersistedDarkMode)
	const toggleDarkMode = useCallback(() => {
		saveThemePreference(!darkMode)
		setDarkMode(!darkMode)
	}, [darkMode])
	const theme = useMemo<PlayerTheme>(
		() => ({ darkMode, palette: NEUTRAL_PALETTE, toggleDarkMode }),
		[darkMode, toggleDarkMode],
	)
	return (
		<PlayerThemeContext.Provider value={theme}>
			{children}
		</PlayerThemeContext.Provider>
	)
}
