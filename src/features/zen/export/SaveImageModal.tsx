import type { RefObject } from 'react'
import { useId, useMemo, useState } from 'react'
import { useZenState } from '@/features/zen/state'
import { getThemeColors } from '@/domain/palettes'
import { useImageExport } from './useImageExport'
import { computeAspectRatioForShape } from '@/domain/shapes'
import {
	getIncludeGridLines,
	getTransparentBackground,
	saveIncludeGridLines,
	saveTransparentBackground,
} from './imageExportPreferences'
import { Button, Checkbox, Loading, Modal, ModalHeader } from '@/ui/components'
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
	const [transparent, setTransparent] = useState(getTransparentBackground)
	const { state } = useZenState()
	const gridSize = state.gridSizes[state.gridShape]
	const { base } = getThemeColors(state.darkMode)
	const { exportState, canShare, handleDownload, handleShare } =
		useImageExport(
			svgRef,
			open || previewOpen,
			base,
			includeGridLines,
			transparent,
		)
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
			<Checkbox
				className={styles.transparentToggle}
				label="Transparent background"
				checked={transparent}
				onChange={checked => {
					setTransparent(checked)
					saveTransparentBackground(checked)
				}}
			/>
			<div
				className={`${styles.preview} ${transparent ? styles.checkerboard : ''}`}
				style={{ aspectRatio: previewAspectRatio }}
			>
				{exportState.status === 'generating' && (
					<Loading label="Generating image…" variant="section" />
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
