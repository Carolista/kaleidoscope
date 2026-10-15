import type { RefObject } from 'react'
import { useId, useMemo, useState } from 'react'
import { useAppState } from '@state/useAppState'
import { getThemeColors } from '@state/theme'
import { useImageExport } from '@hooks/useImageExport'
import { computeAspectRatioForShape } from '@utils/gridShapeRegistry'
import {
	getIncludeGridLines,
	saveIncludeGridLines,
} from '../../services/imageExportPreferences'
import { Button, Checkbox, Modal, ModalHeader, Spinner } from '@shared'
import styles from './SaveImageModal.module.css'

export interface SaveImageModalProps {
	readonly open: boolean
	readonly svgRef: RefObject<SVGSVGElement | null>
	readonly onClose: () => void
}

function SaveImageModal({ open, svgRef, onClose }: SaveImageModalProps) {
	const titleId = useId()
	// Keep the preview URL alive until the dialog has finished fading out.
	const [previewOpen, setPreviewOpen] = useState(open)
	if (open && !previewOpen) setPreviewOpen(true)
	const [includeGridLines, setIncludeGridLines] =
		useState(getIncludeGridLines)
	const { state } = useAppState()
	const gridSize = state.gridSizes[state.gridShape]
	const { base } = getThemeColors(state.darkMode)
	const { exportState, canShare, handleDownload, handleShare } =
		useImageExport(svgRef, open || previewOpen, base, includeGridLines)
	// Reflects the current shape's fixed proportions, which the export
	// service also rasterizes from, so the preview box is already sized
	// correctly before the image exists.
	const previewAspectRatio = useMemo(
		() => computeAspectRatioForShape(state.gridShape, gridSize),
		[state.gridShape, gridSize],
	)

	return (
		<Modal
			open={open}
			onClose={onClose}
			onAfterClose={() => setPreviewOpen(false)}
			labelledBy={titleId}
			className={styles.dialog}
			header={
				<ModalHeader
					title="Save Image"
					titleId={titleId}
					closeLabel="Close"
					onClose={onClose}
				/>
			}
		>
			<Checkbox
				className={styles.gridLinesToggle}
				label="Include grid lines"
				checked={includeGridLines}
				onChange={checked => {
					setIncludeGridLines(checked)
					saveIncludeGridLines(checked)
				}}
			/>
			<div
				className={styles.preview}
				style={{ aspectRatio: previewAspectRatio }}
			>
				{exportState.status === 'generating' && (
					<div className={styles.generating} role="status">
						<Spinner />
						<p>Generating image…</p>
					</div>
				)}
				{exportState.status === 'error' && (
					<p role="alert">
						Sorry, something went wrong generating the image.
					</p>
				)}
				{exportState.status === 'ready' && (
					<img
						src={exportState.url}
						alt="Preview of your kaleidoscope design"
						className={styles.image}
					/>
				)}
			</div>

			{exportState.status === 'ready' && exportState.shareError && (
				<p role="alert">{exportState.shareError}</p>
			)}
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
