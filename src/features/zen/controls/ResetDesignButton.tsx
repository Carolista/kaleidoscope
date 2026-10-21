import { useState } from 'react'
import { faRotate } from '@fortawesome/sharp-duotone-solid-svg-icons'
import {
	isConfirmDialogDismissed,
	ConfirmDialog,
	PlayerIconButton as IconButton,
} from '@/ui/components'
import { useZenState } from '@/features/zen/state'

const DONT_SHOW_AGAIN_KEY = 'reset-design'

function ResetDesignButton() {
	const { resetDesign } = useZenState()
	const [confirming, setConfirming] = useState(false)

	return (
		<>
			<IconButton
				icon={faRotate}
				label="Reset the design board"
				onClick={() => {
					if (isConfirmDialogDismissed(DONT_SHOW_AGAIN_KEY)) {
						resetDesign()
					} else {
						setConfirming(true)
					}
				}}
			/>
			<ConfirmDialog
				open={confirming}
				title="Confirm Reset"
				message="Are you sure you want to reset your design? You can undo this afterward if you change your mind."
				confirmLabel="Reset"
				cancelLabel="Cancel"
				dontShowAgainKey={DONT_SHOW_AGAIN_KEY}
				onConfirm={() => {
					resetDesign()
					setConfirming(false)
				}}
				onCancel={() => setConfirming(false)}
			/>
		</>
	)
}

export default ResetDesignButton
