import { useState } from 'react'
import { useAppState } from '../state/useAppState'
import ConfirmDialog from './ConfirmDialog'
import IconButton from './shared/IconButton'

function ResetButton() {
	const { resetDesign } = useAppState()
	const [confirming, setConfirming] = useState(false)

	return (
		<>
			<IconButton
				icon="eraser"
				label="Reset design"
				onClick={() => setConfirming(true)}
			/>
			<ConfirmDialog
				open={confirming}
				title="Reset design?"
				message="Are you sure you want to reset your design? You can undo this afterward if you change your mind."
				confirmLabel="Reset"
				cancelLabel="Cancel"
				onConfirm={() => {
					resetDesign()
					setConfirming(false)
				}}
				onCancel={() => setConfirming(false)}
			/>
		</>
	)
}

export default ResetButton
