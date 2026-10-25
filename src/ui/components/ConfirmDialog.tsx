import { useId, useState, type ReactNode, type RefObject } from 'react'
import { dismissConfirmDialog } from './confirmDialogPreferences'
import Button from './Button'
import Checkbox from './Checkbox'
import Heading from './Heading'
import styles from './ConfirmDialog.module.css'
import Modal from './Modal'
import CloseButton from './CloseButton'
import Loading from './Loading'

export interface ConfirmDialogProps {
	readonly open: boolean
	readonly title: string
	readonly message?: ReactNode
	readonly children?: ReactNode
	readonly pending?: string | null
	readonly error?: string
	readonly confirmDisabled?: boolean
	readonly destructive?: boolean
	readonly confirmForm?: string
	readonly closeLabel?: string
	readonly initialFocusRef?: RefObject<HTMLElement | null>
	readonly confirmLabel?: string
	readonly cancelLabel?: string
	readonly onConfirm: () => void
	readonly onCancel: () => void
	readonly onAfterClose?: () => void
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
	children,
	pending,
	error,
	confirmDisabled = false,
	destructive = false,
	confirmForm,
	closeLabel,
	initialFocusRef,
	onAfterClose,
}: ConfirmDialogProps) {
	const titleId = useId()
	const [dontShowAgain, setDontShowAgain] = useState(false)

	function handleConfirm() {
		if (!open || pending || confirmDisabled) return
		if (dontShowAgainKey && dontShowAgain) {
			dismissConfirmDialog(dontShowAgainKey)
		}
		setDontShowAgain(false)
		onConfirm()
	}

	function handleCancel() {
		if (!open || pending) return
		setDontShowAgain(false)
		onCancel()
	}

	return (
		<Modal
			open={open}
			onClose={handleCancel}
			onAfterClose={onAfterClose}
			dismissible={!pending}
			initialFocusRef={initialFocusRef}
			labelledBy={titleId}
			className={styles.dialog}
			header={
				<div className={styles.heading}>
					<Heading level={2} id={titleId} className={styles.title}>
						{title}
					</Heading>
					{closeLabel && (
						<CloseButton
							label={closeLabel}
							onClick={handleCancel}
							disabled={!!pending || !open}
						/>
					)}
				</div>
			}
		>
			{message && <p className={styles.message}>{message}</p>}
			{children}
			{error && <p role="alert">{error}</p>}
			{pending && <Loading label={pending} />}
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
					<Button
						variant="outline"
						onClick={handleCancel}
						disabled={!!pending || !open}
					>
						{cancelLabel}
					</Button>
					<Button
						type={confirmForm ? 'submit' : 'button'}
						form={confirmForm}
						variant={destructive ? 'danger' : 'solid'}
						disabled={!!pending || confirmDisabled || !open}
						onClick={confirmForm ? undefined : handleConfirm}
					>
						{confirmLabel}
					</Button>
				</div>
			</div>
		</Modal>
	)
}

export default ConfirmDialog
