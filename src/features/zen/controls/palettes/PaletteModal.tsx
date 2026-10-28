import { useId } from 'react'
import { Modal, ModalHeader } from '@/ui/components'
import PalettePicker from './PalettePicker'
import styles from './PaletteModal.module.css'

export interface PaletteModalProps {
	readonly open: boolean
	readonly onClose: () => void
	readonly newIds?: ReadonlySet<string>
}

function PaletteModal({ open, onClose, newIds }: PaletteModalProps) {
	const titleId = useId()
	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy={titleId}
			className={styles.dialog}
			header={
				<ModalHeader
					title="Color Palette"
					titleId={titleId}
					closeLabel="Close color palette selector"
					onClose={onClose}
				/>
			}
		>
			<div className={styles.content}>
				<PalettePicker newIds={newIds} onSelected={onClose} />
			</div>
		</Modal>
	)
}

export default PaletteModal
