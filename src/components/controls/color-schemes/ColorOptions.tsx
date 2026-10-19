import { useAppState } from '@/state/useAppState'
import { getThemeColors } from '@/state/theme'
import ColorSwatches from './ColorSwatches'

// The 7 colors the user can currently paint with: the active scheme's 5
// colors, plus the always-available base and accent (swap with dark mode).
function ColorOptions() {
	const { state, selectColor } = useAppState()
	const { base, accent } = getThemeColors(state.darkMode)

	const options: { readonly color: string; readonly label: string }[] = [
		...state.currentScheme.colors.map((color, i) => ({
			color,
			label: `Color ${i + 1}`,
		})),
		{ color: base, label: 'Base color' },
		{ color: accent, label: 'Accent color' },
	]

	return (
		<ColorSwatches
			options={options}
			selectedColor={state.currentColor}
			onSelect={selectColor}
		/>
	)
}

export default ColorOptions
