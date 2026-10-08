import Modal from './Modal'
import SchemePicker from './SchemePicker'
import DarkModeToggle from './DarkModeToggle'
import styles from './SettingsModal.module.css'

export interface SettingsModalProps {
	readonly open: boolean
	readonly onClose: () => void
}

/** Houses the less-frequently-used controls: color theme selection and dark/light mode. */
function SettingsModal({ open, onClose }: SettingsModalProps) {
	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy="settings-modal-title"
			className={styles.dialog}
		>
			<div className={styles.header}>
				<h2 id="settings-modal-title" className={styles.title}>
					Settings
				</h2>
				<button
					type="button"
					className={styles.closeButton}
					aria-label="Close settings"
					onClick={onClose}
				>
					×
				</button>
			</div>
			<section className={styles.section}>
				<h3 className={styles.sectionTitle}>Appearance</h3>
				<DarkModeToggle />
			</section>
			<section className={styles.section}>
				<h3 className={styles.sectionTitle}>Color Theme</h3>
				<SchemePicker />
			</section>
		</Modal>
	)
}

export default SettingsModal
