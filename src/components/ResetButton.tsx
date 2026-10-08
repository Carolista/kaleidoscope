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
				aria-label="Reset design"
				title="Reset design"
				onClick={() => setConfirming(true)}
			>
				<i className="fa-solid fa-eraser fa-2x" aria-hidden="true"></i>
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
