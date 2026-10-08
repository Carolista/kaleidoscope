import type { RefObject } from 'react'
import { useAppState } from '../../state/useAppState'
import { getThemeColors } from '../../state/theme'
import { useImageExport } from '../../hooks/useImageExport'
import Button from '../shared/Button'
import CloseButton from '../shared/CloseButton'
import Modal from '../shared/Modal'
import styles from './SaveImageModal.module.css'

export interface SaveImageModalProps {
	readonly open: boolean
	readonly svgRef: RefObject<SVGSVGElement | null>
	readonly onClose: () => void
}

function SaveImageModal({ open, svgRef, onClose }: SaveImageModalProps) {
	const { state } = useAppState()
	const { base } = getThemeColors(state.darkMode)
	const { exportState, canShare, handleDownload, handleShare } =
		useImageExport(svgRef, open, base)

	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy="save-image-modal-title"
			className={styles.dialog}
		>
			<div className={styles.header}>
				<h2 id="save-image-modal-title" className={styles.title}>
					Save Image
				</h2>
				<CloseButton label="Close" onClick={onClose} />
			</div>

			<div className={styles.preview}>
				{exportState.status === 'generating' && (
					<p>Generating image…</p>
				)}
				{exportState.status === 'error' && (
					<p>Sorry, something went wrong generating the image.</p>
				)}
				{exportState.status === 'ready' && (
					<img
						src={exportState.url}
						alt="Preview of your kaleidoscope design"
						className={styles.image}
					/>
				)}
			</div>

			<div className={styles.actions}>
				{canShare && <Button onClick={handleShare}>Share</Button>}
				<Button
					disabled={exportState.status !== 'ready'}
					onClick={handleDownload}
				>
					Download
				</Button>
			</div>
		</Modal>
	)
}

export default SaveImageModal
