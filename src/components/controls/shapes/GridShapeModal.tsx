import { CloseButton, Modal } from '@shared'
import GridShapePicker from './GridShapePicker'
import styles from './GridShapeModal.module.css'

export interface GridShapeModalProps {
	readonly open: boolean
	readonly onClose: () => void
}

function GridShapeModal({ open, onClose }: GridShapeModalProps) {
	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy="grid-shape-modal-title"
			className={styles.dialog}
		>
			<div className={styles.header}>
				<h2 id="grid-shape-modal-title" className={styles.title}>
					Grid Shape
				</h2>
				<CloseButton
					label="Close grid shape picker"
					onClick={onClose}
				/>
			</div>
			<div className={styles.content}>
				<GridShapePicker onSelected={onClose} />
			</div>
		</Modal>
	)
}

export default GridShapeModal
