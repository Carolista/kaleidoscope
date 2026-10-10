import { CloseButton, Modal } from '@shared'
import SchemePicker from './SchemePicker'
import styles from './ColorSchemeModal.module.css'

export interface ColorSchemeModalProps {
	readonly open: boolean
	readonly onClose: () => void
}

function ColorSchemeModal({ open, onClose }: ColorSchemeModalProps) {
	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy="color-scheme-modal-title"
			className={styles.dialog}
		>
			<div className={styles.header}>
				<h2 id="color-scheme-modal-title" className={styles.title}>
					Color Palette
				</h2>
				<CloseButton
					label="Close color palette selector"
					onClick={onClose}
				/>
			</div>
			<div className={styles.content}>
				<SchemePicker onSelected={onClose} />
			</div>
		</Modal>
	)
}

export default ColorSchemeModal
