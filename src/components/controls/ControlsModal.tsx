import { useId } from 'react'
import {
	faCircleInfo,
	faEye,
	faEyeSlash,
	faFillDrip,
	faHexagonImage,
	faMagicWandSparkles,
	faMoon,
	faPalette,
	faShapes,
	faSun,
} from '@fortawesome/sharp-duotone-solid-svg-icons'
import {
	faRotateLeft,
	faRotateRight,
	faRotate,
} from '@fortawesome/pro-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useDuotoneIconTint } from '@hooks/useDuotoneIconTint'
import { useIsTouchDevice } from '@hooks/useIsTouchDevice'
import { Modal, ModalHeader } from '@shared'
import styles from './ControlsModal.module.css'

export interface ControlsModalProps {
	readonly open: boolean
	readonly onClose: () => void
}

interface ControlItem {
	// Two icons (e.g. [faSun, faMoon]) represent a toggle between two
	// states.
	readonly icons: readonly IconDefinition[]
	readonly label: string
	readonly description: string
	// Rendered only on touch devices, matching EditableAreaToggle itself
	// (mouse/trackpad users rely on hover instead, so never see this
	// control in the toolbar).
	readonly touchOnly?: boolean
}

const CONTROL_ITEMS: readonly ControlItem[] = [
	{
		icons: [faFillDrip],
		label: 'Paint Colors',
		description:
			'Tap a swatch to select a paint color, then tap any tile in the grid to paint it that color.',
	},
	{
		icons: [faRotateLeft, faRotateRight],
		label: 'Undo / Redo',
		description: 'Step backward or forward through your recent changes.',
	},
	{
		icons: [faEye, faEyeSlash],
		label: 'Show / Hide Editable Area',
		description:
			'Dim the tiles outside the editable area while you design, or show the full kaleidoscope again.',
		touchOnly: true,
	},
	{
		icons: [faPalette],
		label: 'Color Palette',
		description: 'Choose a different set of colors to paint with.',
	},
	{
		icons: [faMagicWandSparkles],
		label: 'Randomize Design',
		description:
			'Generate a random design using your current color palette.',
	},
	{
		icons: [faRotate],
		label: 'Reset Design',
		description: 'Clear your design and start over.',
	},
	{
		icons: [faShapes],
		label: 'Grid Shape',
		description: 'Switch the kaleidoscope to a different grid shape.',
	},
	{
		icons: [faHexagonImage],
		label: 'Create Image',
		description: 'Save your design as an image you can download or share.',
	},
	{
		icons: [faSun, faMoon],
		label: 'Dark / Light Mode',
		description:
			'Switch between dark and light mode. Tiles painted with the base or accent color switch along with it.',
	},
	{
		icons: [faCircleInfo],
		label: 'Help',
		description: 'Reopen these instructions any time.',
	},
]

// Lists every clickable control below the grid with a brief explanation.
// Shown once automatically on a brand-new device (see ControlsInfoButton),
// then available afterward via its own circle-info icon button.
function ControlsModal({ open, onClose }: ControlsModalProps) {
	const titleId = useId()
	const isTouch = useIsTouchDevice()
	const items = CONTROL_ITEMS.filter(item => !item.touchOnly || isTouch)
	const duotoneTint = useDuotoneIconTint()

	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy={titleId}
			className={styles.dialog}
		>
			<ModalHeader
				title="Controls"
				titleId={titleId}
				closeLabel="Close controls help"
				onClose={onClose}
			/>
			<ul className={styles.list}>
				{items.map(item => (
					<li key={item.label} className={styles.item}>
						<div className={styles.icons} aria-hidden="true">
							{item.icons.map(icon => (
								<FontAwesomeIcon
									key={icon.iconName}
									icon={icon}
									style={duotoneTint(icon)}
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
