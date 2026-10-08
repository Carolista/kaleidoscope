import { useAppState } from '../state/useAppState'
import styles from './DarkModeToggle.module.css'

/** Toggles between light and dark mode, flipping any hexes painted base/accent along with it. */
function DarkModeToggle() {
  const { state, toggleDarkMode } = useAppState()

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={state.darkMode}
      onClick={toggleDarkMode}
    >
      {state.darkMode ? 'Light Mode' : 'Dark Mode'}
    </button>
  )
}

export default DarkModeToggle
