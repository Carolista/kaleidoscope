import { useState } from 'react'
import { dismissConfirmDialog } from '../../services/confirmDialogPreferences'
import Button from './Button'
import styles from './ConfirmDialog.module.css'
import Modal from './Modal'

export interface ConfirmDialogProps {
	readonly open: boolean
	readonly title: string
	readonly message: string
	readonly confirmLabel?: string
	readonly cancelLabel?: string
	readonly onConfirm: () => void
	readonly onCancel: () => void
	// Identifies this dialog's own "don't show this again" preference,
	// distinct from every other ConfirmDialog call site. Omit to not offer
	// the checkbox at all (e.g. for a one-off confirmation that should
	// always be shown).
	readonly dontShowAgainKey?: string
}

function ConfirmDialog({
	open,
	title,
	message,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	onConfirm,
	onCancel,
	dontShowAgainKey,
}: ConfirmDialogProps) {
	const [dontShowAgain, setDontShowAgain] = useState(false)

	function handleConfirm() {
		if (dontShowAgainKey && dontShowAgain) {
			dismissConfirmDialog(dontShowAgainKey)
		}
		setDontShowAgain(false)
		onConfirm()
	}

	function handleCancel() {
		setDontShowAgain(false)
		onCancel()
	}

	return (
		<Modal
			open={open}
			onClose={handleCancel}
			labelledBy="confirm-dialog-title"
			className={styles.dialog}
		>
			<h2 id="confirm-dialog-title" className={styles.title}>
				{title}
			</h2>
			<p className={styles.message}>{message}</p>
			<div className={styles.bottomRow}>
				{dontShowAgainKey && (
					<label className={styles.dontShowAgain}>
						<span
							className={
								dontShowAgain
									? styles.checkboxBox
									: `${styles.checkboxBox} ${styles.checkboxBoxEmpty}`
							}
						>
							<input
								type="checkbox"
								className={styles.checkboxInput}
								checked={dontShowAgain}
								onChange={event =>
									setDontShowAgain(event.target.checked)
								}
							/>
							{dontShowAgain && (
								<i
									className="fa-solid fa-square-check"
									aria-hidden="true"
								></i>
							)}
						</span>
						Don't show this again
					</label>
				)}
				<div className={styles.actions}>
					<Button variant="outline" onClick={handleCancel}>
						{cancelLabel}
					</Button>
					<Button onClick={handleConfirm}>{confirmLabel}</Button>
				</div>
			</div>
		</Modal>
	)
}

export default ConfirmDialog
