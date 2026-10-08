import { colorSchemes } from '../data/colorSchemes'
import { useAppState } from '../state/useAppState'
import styles from './SchemePicker.module.css'

// Clicking a row selects it as the current scheme, which also resets the
// current paint color to the scheme's first color (see the reducer's
// SELECT_SCHEME).
function SchemePicker() {
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
						onClick={() => selectScheme(scheme)}
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
