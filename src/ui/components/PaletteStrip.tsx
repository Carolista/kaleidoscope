import styles from './PaletteStrip.module.css'

export default function PaletteStrip({
	colors,
	variant = 'swatches',
}: {
	readonly colors: readonly string[]
	readonly variant?: 'swatches' | 'compact' | 'continuous'
}) {
	return (
		<span
			className={`${styles.strip} ${styles[variant]}`}
			aria-hidden="true"
		>
			{colors.map((color, slot) => (
				<span key={slot} style={{ backgroundColor: color }} />
			))}
		</span>
	)
}
