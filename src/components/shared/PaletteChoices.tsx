import PaletteStrip from './PaletteStrip'
import styles from './PaletteChoices.module.css'

export interface PaletteChoice {
	readonly id: string
	readonly name: string
	readonly colors: readonly string[]
}

export default function PaletteChoices({
	palettes,
	selectedId,
	onSelect,
	disabled = false,
	showNames = false,
	label = palette => `Select the ${palette.name} color palette`,
}: {
	readonly palettes: readonly PaletteChoice[]
	readonly selectedId?: string
	readonly onSelect: (id: string) => void
	readonly disabled?: boolean
	readonly showNames?: boolean
	readonly label?: (palette: PaletteChoice) => string
}) {
	return (
		<ul className={styles.list}>
			{palettes.map(palette => (
				<li key={palette.id}>
					<button
						type="button"
						className={styles.choice}
						title={palette.name}
						aria-label={label(palette)}
						aria-pressed={selectedId === palette.id}
						disabled={disabled}
						onClick={() => onSelect(palette.id)}
					>
						<PaletteStrip colors={palette.colors} />
						{showNames && <span>{palette.name}</span>}
					</button>
				</li>
			))}
		</ul>
	)
}
