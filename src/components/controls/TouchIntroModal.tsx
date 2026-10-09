import Button from '../shared/Button'
import Modal from '../shared/Modal'
import styles from './TouchIntroModal.module.css'

export interface TouchIntroModalProps {
	readonly open: boolean
	readonly onClose: () => void
}

// Shown once, on first-ever load on a touch device (see App.tsx for the
// open condition), to point out the eye toggle since touch has no hover
// equivalent for discovering the editable wedge.
function TouchIntroModal({ open, onClose }: TouchIntroModalProps) {
	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy="touch-intro-modal-title"
			className={styles.dialog}
		>
			<h2 id="touch-intro-modal-title" className={styles.title}>
				How to Switch Your View
			</h2>
			<p className={styles.message}>
				Tapping the{' '}
				<i className="fa-solid fa-eye" aria-hidden="true"></i> icon in
				the toolbar will dim the tiles outside the painting area while
				you're designing. Tap{' '}
				<i className="fa-solid fa-eye-slash" aria-hidden="true"></i> to
				show the full kaleidoscope.
			</p>
			<div className={styles.actions}>
				<Button onClick={onClose}>Got It</Button>
			</div>
		</Modal>
	)
}

export default TouchIntroModal
