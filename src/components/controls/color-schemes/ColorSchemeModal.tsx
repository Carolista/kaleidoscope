import { useId } from 'react'
import { Modal, ModalHeader } from '@shared'
import SchemePicker from './SchemePicker'
import styles from './ColorSchemeModal.module.css'

export interface ColorSchemeModalProps {
	readonly open: boolean
	readonly onClose: () => void
}

function ColorSchemeModal({ open, onClose }: ColorSchemeModalProps) {
	const titleId = useId()
	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy={titleId}
			className={styles.dialog}
		>
			<ModalHeader
				title="Color Palette"
				titleId={titleId}
				closeLabel="Close color palette selector"
				onClose={onClose}
			/>
			<div className={styles.content}>
				<SchemePicker onSelected={onClose} />
			</div>
		</Modal>
	)
}

export default ColorSchemeModal
