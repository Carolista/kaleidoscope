import styles from './ColorOptions.module.css'

interface ColorSwatchesProps {
	readonly options: readonly {
		readonly color: string
		readonly label: string
	}[]
	readonly selectedColor: string | null
	readonly onSelect: (color: string) => void
	readonly disabledColors?: readonly string[]
}

function ColorSwatches({
	options,
	selectedColor,
	onSelect,
	disabledColors = [],
}: ColorSwatchesProps) {
	return (
		<div
			className={styles.options}
			role="group"
			aria-label="Current Color Options"
		>
			{options.map(({ color, label }) => (
				<button
					key={label}
					type="button"
					className={styles.swatch}
					style={{ backgroundColor: color }}
					aria-label={label}
					aria-pressed={selectedColor === color}
					disabled={disabledColors.includes(color)}
					onClick={() => onSelect(color)}
				/>
			))}
		</div>
	)
}

export default ColorSwatches
