import { useAppState } from '../state/useAppState'
import { useIsTouchDevice } from '../utils/useIsTouchDevice'
import styles from './EditableAreaToggle.module.css'

// Touch devices have no hover, so there's no way to discover the editable
// wedge the way mouse users can (see HexGrid's hover-driven dimming). This
// button offers the same dimming effect on demand instead, and only
// renders on touch devices since mouse/trackpad users already have hover.
function EditableAreaToggle() {
	const isTouch = useIsTouchDevice()
	const { state, toggleEditableArea } = useAppState()

	if (!isTouch) return null

	const label = state.showEditableArea
		? 'Hide editable area'
		: 'Show editable area'

	return (
		<button
			type="button"
			className={styles.toggle}
			aria-label={label}
			title={label}
			onClick={toggleEditableArea}
		>
			{/* Icon shows the state a click leads to, matching the label. */}
			<i
				className={`fa-solid ${state.showEditableArea ? 'fa-eye-slash' : 'fa-eye'} fa-2x`}
				aria-hidden="true"
			></i>
		</button>
	)
}

export default EditableAreaToggle
