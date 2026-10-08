import { useState } from 'react'
import { useAppState } from '../state/useAppState'
import ConfirmDialog from './ConfirmDialog'
import styles from './ResetButton.module.css'

function ResetButton() {
	const { resetDesign } = useAppState()
	const [confirming, setConfirming] = useState(false)

	return (
		<>
			<button
				type="button"
				className={styles.reset}
				onClick={() => setConfirming(true)}
			>
				Reset Design
			</button>
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
