import Button from './Button'
import Modal from './Modal'
import styles from './ConfirmDialog.module.css'

export interface ConfirmDialogProps {
	readonly open: boolean
	readonly title: string
	readonly message: string
	readonly confirmLabel?: string
	readonly cancelLabel?: string
	readonly onConfirm: () => void
	readonly onCancel: () => void
}

function ConfirmDialog({
	open,
	title,
	message,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	return (
		<Modal
			open={open}
			onClose={onCancel}
			labelledBy="confirm-dialog-title"
			className={styles.dialog}
		>
			<h2 id="confirm-dialog-title" className={styles.title}>
				{title}
			</h2>
			<p className={styles.message}>{message}</p>
			<div className={styles.actions}>
				<Button variant="outline" onClick={onCancel}>
					{cancelLabel}
				</Button>
				<Button onClick={onConfirm}>{confirmLabel}</Button>
			</div>
		</Modal>
	)
}

export default ConfirmDialog
