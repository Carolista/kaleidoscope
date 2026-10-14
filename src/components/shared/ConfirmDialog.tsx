import { useId, useState } from 'react'
import { dismissConfirmDialog } from '@services/confirmDialogPreferences'
import Button from './Button'
import Checkbox from './Checkbox'
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
	const titleId = useId()
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
			labelledBy={titleId}
			className={styles.dialog}
			header={
				<h2 id={titleId} className={styles.title}>
					{title}
				</h2>
			}
		>
			<p className={styles.message}>{message}</p>
			<div className={styles.bottomRow}>
				{dontShowAgainKey && (
					<Checkbox
						className={styles.dontShowAgain}
						label="Don't show this again"
						checked={dontShowAgain}
						onChange={setDontShowAgain}
					/>
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
