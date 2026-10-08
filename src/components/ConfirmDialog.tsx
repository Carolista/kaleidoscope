import { useEffect, useRef } from 'react'
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

/**
 * A reusable modal confirmation dialog built on the native `<dialog>`
 * element, which gives us a backdrop, focus trapping, and Esc-to-cancel
 * for free. `open` is controlled by the parent; the dialog is imperatively
 * shown/closed to match, since `<dialog>` doesn't support a declarative
 * `open` attribute that also triggers modal (backdrop + focus trap) behavior.
 */
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
      className={styles.dialog}
      aria-labelledby="confirm-dialog-title"
      onCancel={(event) => {
        // Native Esc-to-cancel; prevent the default close so our effect
        // (driven by the parent flipping `open`) stays the single source
        // of truth for when the dialog actually closes.
        event.preventDefault()
        onCancel()
      }}
      onClick={(event) => {
        // The <dialog> element itself fills the viewport when shown as a
        // modal, so a click landing directly on it (not its content) is a
        // click on the backdrop area.
        if (event.target === dialogRef.current) onCancel()
      }}
    >
      <h2 id="confirm-dialog-title" className={styles.title}>
        {title}
      </h2>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={styles.confirm} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}

export default ConfirmDialog
