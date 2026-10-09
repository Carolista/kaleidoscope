import { useAppState } from '../../state/useAppState'
import IconButton from '../shared/IconButton'

// Flips any tiles painted base/accent along with the mode (see
// TOGGLE_DARK_MODE in the reducer).
function DarkModeToggle() {
	const { state, toggleDarkMode } = useAppState()
	const label = state.darkMode
		? 'Switch to light mode'
		: 'Switch to dark mode'

	return (
		// Icon shows the mode a click leads to (sun/day while in dark mode,
		// moon/night while in light mode), matching the label.
		<IconButton
			icon={state.darkMode ? 'sun' : 'moon'}
			label={label}
			onClick={toggleDarkMode}
		/>
	)
}

export default DarkModeToggle
