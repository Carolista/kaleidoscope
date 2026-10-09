import { colorSchemes } from '../../../data/colorSchemes'
import { useAppState } from '../../../state/useAppState'
import styles from './SchemePicker.module.css'

export interface SchemePickerProps {
	// Called right after a scheme is selected, so the containing modal can
	// close itself instead of staying open on the now-applied picker.
	readonly onSelected?: () => void
}

// Clicking a row selects it as the current scheme, which also resets the
// current paint color to the scheme's first color (see the reducer's
// SELECT_SCHEME).
function SchemePicker({ onSelected }: SchemePickerProps) {
	const { state, selectScheme } = useAppState()

	return (
		<ul className={styles.list}>
			{colorSchemes.map(scheme => (
				<li key={scheme.name}>
					<button
						type="button"
						className={styles.schemeButton}
						aria-pressed={state.currentScheme.name === scheme.name}
						aria-label={`Select the ${scheme.name} color scheme`}
						onClick={() => {
							selectScheme(scheme)
							onSelected?.()
						}}
					>
						{scheme.colors.map((color, i) => (
							<span
								key={i}
								className={styles.swatch}
								style={{ backgroundColor: color }}
								aria-hidden="true"
							/>
						))}
					</button>
				</li>
			))}
		</ul>
	)
}

export default SchemePicker
