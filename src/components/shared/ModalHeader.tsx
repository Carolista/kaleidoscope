import CloseButton from './CloseButton'
import styles from './ModalHeader.module.css'

export interface ModalHeaderProps {
	readonly title: string
	readonly titleId: string
	readonly closeLabel: string
	readonly onClose: () => void
}

function ModalHeader({
	title,
	titleId,
	closeLabel,
	onClose,
}: ModalHeaderProps) {
	return (
		<div className={styles.header}>
			<h2 id={titleId} className={styles.title}>
				{title}
			</h2>
			<CloseButton label={closeLabel} onClick={onClose} />
		</div>
	)
}

export default ModalHeader
