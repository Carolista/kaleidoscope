import { useAppState } from '../state/useAppState'
import styles from './DarkModeToggle.module.css'

// Flips any hexes painted base/accent along with the mode (see
// TOGGLE_DARK_MODE in the reducer).
function DarkModeToggle() {
	const { state, toggleDarkMode } = useAppState()
	const label = state.darkMode
		? 'Switch to light mode'
		: 'Switch to dark mode'

	return (
		<button
			type="button"
			className={styles.toggle}
			aria-label={label}
			title={label}
			onClick={toggleDarkMode}
		>
			{/* Icon shows the mode a click leads to (sun/day while in dark
          mode, moon/night while in light mode), matching the label. */}
			<i
				className={`fa-solid ${state.darkMode ? 'fa-sun' : 'fa-moon'} fa-2x`}
				aria-hidden="true"
			></i>
		</button>
	)
}

export default DarkModeToggle
