import type { PlayerTheme } from '@/ui/theme'
import { PlayerThemeContext } from '@/ui/theme'
import { readPersistedDarkMode } from '@/features/zen'
import { useMemo, type ReactNode } from 'react'

const NEUTRAL_PALETTE = {
	name: '',
	colors: ['#8a8f98', '#a0a5ad', '#b6bac1', '#cbced4', '#e0e2e6'],
} as const

// The theme for the app frame while the player's content is still loading: the
// saved light or dark mode, a neutral palette, and no way to change either yet.
// Zen's state provider replaces it once content is ready.
export default function ProvisionalTheme({
	children,
}: {
	readonly children: ReactNode
}) {
	const theme = useMemo<PlayerTheme>(
		() => ({
			darkMode: readPersistedDarkMode(),
			palette: NEUTRAL_PALETTE,
			toggleDarkMode: () => undefined,
		}),
		[],
	)
	return (
		<PlayerThemeContext.Provider value={theme}>
			{children}
		</PlayerThemeContext.Provider>
	)
}
