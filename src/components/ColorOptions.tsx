import type { CSSProperties } from 'react'
import { useAppState } from '../state/useAppState'
import { getThemeColors } from '../state/theme'
import styles from './ColorOptions.module.css'

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
		<div
			className={styles.options}
			role="group"
			aria-label="Current color options"
			style={{ '--swatch-selected-border': accent } as CSSProperties}
		>
			{options.map(({ color, label }) => (
				<button
					key={label}
					type="button"
					className={styles.swatch}
					style={{ backgroundColor: color }}
					aria-label={label}
					aria-pressed={state.currentColor === color}
					onClick={() => selectColor(color)}
				/>
			))}
		</div>
	)
}

export default ColorOptions
