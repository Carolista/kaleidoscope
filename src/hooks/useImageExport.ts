import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import {
	buildExportFilename,
	exportSvgAsPngBlob,
} from '../services/imageExportService'

export type ExportState =
	| { readonly status: 'generating' }
	| {
			readonly status: 'ready'
			readonly blob: Blob
			readonly url: string
			readonly filename: string
			readonly shareError?: string
	  }
	| { readonly status: 'error' }

export interface UseImageExportResult {
	readonly exportState: ExportState
	readonly canShare: boolean
	readonly handleDownload: () => void
	readonly handleShare: () => Promise<void>
}

function canShareFiles(file: File): boolean {
	return (
		typeof navigator.share === 'function' &&
		typeof navigator.canShare === 'function' &&
		navigator.canShare({ files: [file] })
	)
}

// Renders `svg` to a PNG blob whenever `open` becomes true, and exposes
// download/share actions built on top of the result. Pulled out of
// SaveImageModal so that component stays focused on markup/presentation.
export function useImageExport(
	svgRef: RefObject<SVGSVGElement | null>,
	open: boolean,
	backgroundColor: string,
): UseImageExportResult {
	const [exportState, setExportState] = useState<ExportState>({
		status: 'generating',
	})

	useEffect(() => {
		if (!open) return
		const svg = svgRef.current
		if (!svg) {
			setExportState({ status: 'error' })
			return
		}

		let cancelled = false
		setExportState({ status: 'generating' })

		exportSvgAsPngBlob(svg, { backgroundColor })
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
		setExportState({ ...exportState, shareError: undefined })
		try {
			await navigator.share({
				files: [file],
				title: 'My Kaleidoscope design',
			})
		} catch (error) {
			// AbortError just means the user cancelled the share sheet.
			if (error instanceof Error && error.name === 'AbortError') return
			setExportState(current =>
				current.status === 'ready' && current.url === exportState.url
					? {
							...current,
							shareError:
								'Sorry, sharing failed. You can try again or download your image instead.',
						}
					: current,
			)
		}
	}

	const canShare =
		exportState.status === 'ready' &&
		canShareFiles(
			new File([exportState.blob], exportState.filename, {
				type: 'image/png',
			}),
		)

	return { exportState, canShare, handleDownload, handleShare }
}
