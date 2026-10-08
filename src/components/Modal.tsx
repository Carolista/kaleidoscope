import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import styles from './Modal.module.css'

export interface ModalProps {
	readonly open: boolean
	readonly onClose: () => void
	// id of the element (usually a heading) that labels this dialog for assistive tech.
	readonly labelledBy: string
	// Extra class merged onto the `<dialog>` element, e.g. to set a max-width.
	readonly className?: string
	readonly children: ReactNode
}

// Built on the native `<dialog>` element, which gives us a backdrop, focus
// trapping, and Esc-to-cancel for free. `open` is controlled by the
// parent; the dialog is imperatively shown/closed to match, since
// `<dialog>` doesn't support a declarative `open` attribute that also
// triggers modal (backdrop + focus trap) behavior.
function Modal({ open, onClose, labelledBy, className, children }: ModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null)

	useEffect(() => {
		const dialog = dialogRef.current
		if (!dialog) return

		if (open && !dialog.open) {
			dialog.showModal()
		} else if (!open && dialog.open) {
			dialog.close()
		}
	}, [open])

	return (
		<dialog
			ref={dialogRef}
			className={[styles.dialog, className].filter(Boolean).join(' ')}
			aria-labelledby={labelledBy}
			onCancel={event => {
				// Native Esc-to-close; prevent the default close so our effect
				// (driven by the parent flipping `open`) stays the single source
				// of truth for when the dialog actually closes.
				event.preventDefault()
				onClose()
			}}
			onClick={event => {
				// The <dialog> element itself fills the viewport when shown as a
				// modal, so a click landing directly on it (not its content) is a
				// click on the backdrop area.
				if (event.target === dialogRef.current) onClose()
			}}
		>
			{children}
		</dialog>
	)
}

export default Modal
