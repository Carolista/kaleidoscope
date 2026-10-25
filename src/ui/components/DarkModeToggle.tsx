import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faSun } from '@fortawesome/pro-solid-svg-icons'
import { usePlayerTheme } from '@/ui/theme'
import Button from './Button'
import styles from './DarkModeToggle.module.css'

// Zen's provider also flips any tiles painted base/accent along with the mode
// (see TOGGLE_DARK_MODE in its reducer).
function DarkModeToggle() {
	const { darkMode, toggleDarkMode } = usePlayerTheme()
	const label = darkMode ? 'Switch to light mode' : 'Switch to dark mode'

	return (
		// Icon and label show the mode a click leads to (sun/day while in dark
		// mode, moon/night while in light mode).
		<Button
			variant="outline"
			className={styles.toggle}
			onClick={toggleDarkMode}
		>
			<FontAwesomeIcon
				icon={darkMode ? faSun : faMoon}
				aria-hidden="true"
			/>
			{label}
		</Button>
	)
}

export default DarkModeToggle
