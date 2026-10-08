import { useAppState } from '../state/useAppState'
import styles from './DarkModeToggle.module.css'

// Flips any hexes painted base/accent along with the mode (see
// TOGGLE_DARK_MODE in the reducer).
function DarkModeToggle() {
	const { state, toggleDarkMode } = useAppState()

	return (
		<button
			type="button"
			className={styles.toggle}
			onClick={toggleDarkMode}
		>
			{/* The label names the action's destination mode, not the current
          state, so aria-pressed (which describes current state) would be
          misleading here -- the label text alone fully conveys the action. */}
			{state.darkMode ? 'Light Mode' : 'Dark Mode'}
		</button>
	)
}

export default DarkModeToggle
