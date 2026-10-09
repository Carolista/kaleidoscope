import { useAppState } from '@state/useAppState'
import { useIsTouchDevice } from '@utils/useIsTouchDevice'
import { IconButton } from '@shared'

// Touch devices have no hover, so there's no way to discover the editable
// wedge the way mouse users can (see HexagonGrid's hover-driven dimming). This
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
		// Icon shows the state a click leads to, matching the label.
		<IconButton
			icon={state.showEditableArea ? 'eye-slash' : 'eye'}
			label={label}
			onClick={toggleEditableArea}
		/>
	)
}

export default EditableAreaToggle
