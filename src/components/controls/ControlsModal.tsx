import { useIsTouchDevice } from '@hooks/useIsTouchDevice'
import { CloseButton, Modal } from '@shared'
import styles from './ControlsModal.module.css'

export interface ControlsModalProps {
	readonly open: boolean
	readonly onClose: () => void
}

interface ControlItem {
	// Font Awesome icon names, without the `fa-` prefix. Two icons (e.g.
	// ['sun', 'moon']) represent a toggle between two states.
	readonly icons: readonly string[]
	readonly label: string
	readonly description: string
	// Rendered only on touch devices, matching EditableAreaToggle itself
	// (mouse/trackpad users rely on hover instead, so never see this
	// control in the toolbar).
	readonly touchOnly?: boolean
}

const CONTROL_ITEMS: readonly ControlItem[] = [
	{
		icons: ['fill-drip'],
		label: 'Paint Colors',
		description:
			'Tap a swatch to select a paint color, then tap any tile in the grid to paint it that color.',
	},
	{
		icons: ['rotate-left', 'rotate-right'],
		label: 'Undo / Redo',
		description: 'Step backward or forward through your recent changes.',
	},
	{
		icons: ['eye', 'eye-slash'],
		label: 'Show / Hide Editable Area',
		description:
			'Dim the tiles outside the editable area while you design, or show the full kaleidoscope again.',
		touchOnly: true,
	},
	{
		icons: ['palette'],
		label: 'Color Palette',
		description: 'Choose a different set of colors to paint with.',
	},
	{
		icons: ['magic-wand-sparkles'],
		label: 'Randomize Design',
		description:
			'Generate a random design using your current color palette.',
	},
	{
		icons: ['arrows-rotate'],
		label: 'Reset Design',
		description: 'Clear your design and start over.',
	},
	{
		icons: ['shapes'],
		label: 'Grid Shape',
		description: 'Switch the kaleidoscope to a different grid shape.',
	},
	{
		icons: ['hexagon-image'],
		label: 'Create Image',
		description: 'Save your design as an image you can download or share.',
	},
	{
		icons: ['sun', 'moon'],
		label: 'Dark / Light Mode',
		description:
			'Switch between dark and light mode. Tiles painted with the base or accent color switch along with it.',
	},
	{
		icons: ['circle-info'],
		label: 'Help',
		description: 'Reopen these instructions any time.',
	},
]

// Lists every clickable control below the grid with a brief explanation.
// Shown once automatically on a brand-new device (see ControlsInfoButton),
// then available afterward via its own circle-info icon button.
function ControlsModal({ open, onClose }: ControlsModalProps) {
	const isTouch = useIsTouchDevice()
	const items = CONTROL_ITEMS.filter(item => !item.touchOnly || isTouch)

	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy="controls-modal-title"
			className={styles.dialog}
		>
			<div className={styles.header}>
				<h2 id="controls-modal-title" className={styles.title}>
					Controls
				</h2>
				<CloseButton label="Close controls help" onClick={onClose} />
			</div>
			<ul className={styles.list}>
				{items.map(item => (
					<li key={item.label} className={styles.item}>
						<div className={styles.icons} aria-hidden="true">
							{item.icons.map(icon => (
								<i
									key={icon}
									className={`fa-solid fa-${icon}`}
								/>
							))}
						</div>
						<div>
							<h3 className={styles.itemTitle}>{item.label}</h3>
							<p className={styles.itemDescription}>
								{item.description}
							</p>
						</div>
					</li>
				))}
			</ul>
		</Modal>
	)
}

export default ControlsModal
