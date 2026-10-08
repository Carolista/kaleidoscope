import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { useAppState } from '../state/useAppState'
import { getThemeColors } from '../state/theme'
import { buildExportFilename, exportSvgAsPngBlob } from '../utils/exportImage'
import Modal from './Modal'
import styles from './SaveImageModal.module.css'

export interface SaveImageModalProps {
	readonly open: boolean
	readonly svgRef: RefObject<SVGSVGElement | null>
	readonly onClose: () => void
}

type ExportState =
	| { readonly status: 'generating' }
	| {
			readonly status: 'ready'
			readonly blob: Blob
			readonly url: string
			readonly filename: string
	  }
	| { readonly status: 'error' }

function canShareFiles(file: File): boolean {
	return (
		typeof navigator.share === 'function' &&
		typeof navigator.canShare === 'function' &&
		navigator.canShare({ files: [file] })
	)
}

function SaveImageModal({ open, svgRef, onClose }: SaveImageModalProps) {
	const { state } = useAppState()
	const { base } = getThemeColors(state.darkMode)
	const [exportState, setExportState] = useState<ExportState>({
		status: 'generating',
	})

	useEffect(() => {
		if (!open) return
		const svg = svgRef.current
		if (!svg) return

		let cancelled = false
		setExportState({ status: 'generating' })

		exportSvgAsPngBlob(svg, { backgroundColor: base })
			.then(blob => {
				if (cancelled) return
				setExportState({
					status: 'ready',
					blob,
					url: URL.createObjectURL(blob),
					filename: buildExportFilename(),
				})
			})
			.catch(() => {
				if (!cancelled) setExportState({ status: 'error' })
			})

		return () => {
			cancelled = true
		}
		// Only regenerate when the modal opens; the design underneath
		// shouldn't change while this preview is up.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	useEffect(() => {
		if (exportState.status !== 'ready') return
		const { url } = exportState
		return () => URL.revokeObjectURL(url)
	}, [exportState])

	function handleDownload() {
		if (exportState.status !== 'ready') return
		const link = document.createElement('a')
		link.href = exportState.url
		link.download = exportState.filename
		// Some browsers only honor synthetic clicks on anchors that are
		// actually attached to the document.
		document.body.appendChild(link)
		link.click()
		link.remove()
	}

	async function handleShare() {
		if (exportState.status !== 'ready') return
		const file = new File([exportState.blob], exportState.filename, {
			type: 'image/png',
		})
		try {
			await navigator.share({
				files: [file],
				title: 'My Kaleidoscope design',
			})
		} catch (error) {
			// AbortError just means the user cancelled the share sheet.
			if ((error as Error).name !== 'AbortError') throw error
		}
	}

	const canShare =
		exportState.status === 'ready' &&
		canShareFiles(
			new File([exportState.blob], exportState.filename, {
				type: 'image/png',
			}),
		)

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
				<button
					type="button"
					className={styles.closeButton}
					aria-label="Close"
					onClick={onClose}
				>
					×
				</button>
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
				{canShare && (
					<button
						type="button"
						className={styles.action}
						onClick={handleShare}
					>
						Share
					</button>
				)}
				<button
					type="button"
					className={styles.action}
					disabled={exportState.status !== 'ready'}
					onClick={handleDownload}
				>
					Download
				</button>
			</div>
		</Modal>
	)
}

export default SaveImageModal
