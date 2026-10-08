import CloseButton from '../shared/CloseButton'
import Modal from '../shared/Modal'
import SchemePicker from './SchemePicker'
import styles from './ColorThemeModal.module.css'

export interface ColorThemeModalProps {
	readonly open: boolean
	readonly onClose: () => void
}

function ColorThemeModal({ open, onClose }: ColorThemeModalProps) {
	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy="color-theme-modal-title"
			className={styles.dialog}
		>
			<div className={styles.header}>
				<h2 id="color-theme-modal-title" className={styles.title}>
					Color Theme
				</h2>
				<CloseButton
					label="Close color theme picker"
					onClick={onClose}
				/>
			</div>
			<div className={styles.content}>
				<SchemePicker />
			</div>
		</Modal>
	)
}

export default ColorThemeModal
