import { useState } from 'react'
import { isConfirmDialogDismissed } from '@services/confirmDialogPreferences'
import { useAppState } from '@state/useAppState'
import { ConfirmDialog, IconButton } from '@shared'

const DONT_SHOW_AGAIN_KEY = 'reset-design'

function ResetDesignButton() {
	const { resetDesign } = useAppState()
	const [confirming, setConfirming] = useState(false)

	return (
		<>
			<IconButton
				icon="eraser"
				label="Reset design"
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
				title="Reset design?"
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
