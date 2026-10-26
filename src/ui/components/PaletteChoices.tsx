import { faLock } from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { usePressPreview } from '@/ui/hooks'
import PaletteStrip from './PaletteStrip'
import styles from './PaletteChoices.module.css'

export interface PaletteChoice {
	readonly id: string
	readonly name: string
	readonly colors: readonly string[]
}

export interface LockedPaletteChoice extends PaletteChoice {
	// What the player must do to unlock it, such as "Finish Basic 1".
	readonly requirement: string
}

// A palette not yet earned: it cannot be picked, but pressing it previews its colors.
// It uses aria-disabled rather than disabled so it still receives pointer events and focus.
function LockedChoice({ palette }: { readonly palette: LockedPaletteChoice }) {
	const press = usePressPreview()
	return (
		<button
			type="button"
			className={`${styles.choice} ${styles.locked}`}
			title={`${palette.name}: ${palette.requirement}`}
			aria-label={`${palette.name} color palette, locked. ${palette.requirement}`}
			aria-disabled="true"
			{...press}
		>
			<span className={styles.lockedStrip}>
				<PaletteStrip colors={palette.colors} />
			</span>
			<FontAwesomeIcon
				icon={faLock}
				className={styles.lock}
				aria-hidden="true"
			/>
		</button>
	)
}

export default function PaletteChoices({
	palettes,
	locked = [],
	selectedId,
	newIds,
	onSelect,
	disabled = false,
	isDisabled,
	showNames = false,
	label = palette => `Select the ${palette.name} color palette`,
}: {
	readonly palettes: readonly PaletteChoice[]
	// Palettes still to be earned, listed after the available ones.
	readonly locked?: readonly LockedPaletteChoice[]
	readonly selectedId?: string
	// Palettes to tag with "NEW!".
	readonly newIds?: ReadonlySet<string>
	readonly onSelect: (id: string) => void
	readonly disabled?: boolean
	// Disables individual choices, for palettes that cannot be picked right now.
	readonly isDisabled?: (palette: PaletteChoice) => boolean
	readonly showNames?: boolean
	readonly label?: (palette: PaletteChoice) => string
}) {
	const isNew = (palette: PaletteChoice) => newIds?.has(palette.id) ?? false
	return (
		<ul className={styles.list}>
			{palettes.map(palette => (
				<li key={palette.id}>
					<button
						type="button"
						className={styles.choice}
						title={palette.name}
						aria-label={
							isNew(palette)
								? `${label(palette)} (new)`
								: label(palette)
						}
						aria-pressed={selectedId === palette.id}
						disabled={disabled || isDisabled?.(palette)}
						onClick={() => onSelect(palette.id)}
					>
						<PaletteStrip colors={palette.colors} />
						{showNames && <span>{palette.name}</span>}
						{isNew(palette) && (
							<span className={styles.new} aria-hidden="true">
								NEW!
							</span>
						)}
					</button>
				</li>
			))}
			{locked.length > 0 && (
				<li className={styles.lockedHeading}>Keep solving to unlock</li>
			)}
			{locked.map(palette => (
				<li key={palette.id}>
					<LockedChoice palette={palette} />
				</li>
			))}
		</ul>
	)
}
