import { useZenState } from '@/features/zen/state'
import { getThemeColors } from '@/domain/palettes'
import ColorSwatches from './ColorSwatches'

// The 7 colors the user can currently paint with: the active palette's 5
// colors, plus the always-available base and accent (swap with dark mode).
function ColorOptions() {
	const { state, selectColor } = useZenState()
	const { base, accent } = getThemeColors(state.darkMode)

	const options: { readonly color: string; readonly label: string }[] = [
		...state.currentPalette.colors.map((color, i) => ({
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
