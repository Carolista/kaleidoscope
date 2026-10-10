import { useId } from 'react'
import { Modal, ModalHeader } from '@shared'
import GridShapePicker from './GridShapePicker'
import styles from './GridShapeModal.module.css'

export interface GridShapeModalProps {
	readonly open: boolean
	readonly onClose: () => void
}

function GridShapeModal({ open, onClose }: GridShapeModalProps) {
	const titleId = useId()
	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy={titleId}
			className={styles.dialog}
		>
			<ModalHeader
				title="Grid Shape"
				titleId={titleId}
				closeLabel="Close grid shape selector"
				onClose={onClose}
			/>
			<div className={styles.content}>
				<GridShapePicker onSelected={onClose} />
			</div>
		</Modal>
	)
}

export default GridShapeModal
