import { faMoon, faSun } from '@fortawesome/pro-solid-svg-icons'
import { usePlayerTheme } from '@/ui/theme'
import PlayerIconButton from './PlayerIconButton'

// Zen's provider also flips any tiles painted base/accent along with the mode
// (see TOGGLE_DARK_MODE in its reducer).
function DarkModeToggle() {
	const { darkMode, toggleDarkMode } = usePlayerTheme()
	const label = darkMode ? 'Switch to light mode' : 'Switch to dark mode'

	return (
		// Icon shows the mode a click leads to (sun/day while in dark mode,
		// moon/night while in light mode), matching the label.
		<PlayerIconButton
			icon={darkMode ? faSun : faMoon}
			label={label}
			onClick={toggleDarkMode}
		/>
	)
}

export default DarkModeToggle
