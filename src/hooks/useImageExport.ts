import { useEffect, useRef, useState } from 'react'
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

type Variant = 'withLines' | 'withoutLines'

interface ExportSession {
	active: boolean
	readonly svg: SVGSVGElement | null
	readonly backgroundColor: string
	readonly requested: Set<Variant>
	readonly urls: Set<string>
}

export function useImageExport(
	svgRef: RefObject<SVGSVGElement | null>,
	open: boolean,
	backgroundColor: string,
	includeGridLines = true,
): UseImageExportResult {
	const [previews, setPreviews] = useState<
		Partial<Record<Variant, ExportState>>
	>({})
	const [previousOpen, setPreviousOpen] = useState(open)
	if (previousOpen !== open) {
		setPreviousOpen(open)
		setPreviews({})
	}
	const sessionRef = useRef<ExportSession | null>(null)
	const variant = includeGridLines ? 'withLines' : 'withoutLines'
	const exportState: ExportState = open
		? (previews[variant] ?? { status: 'generating' })
		: { status: 'generating' }

	useEffect(() => {
		if (!open) return
		const session: ExportSession = {
			active: true,
			svg: svgRef.current,
			backgroundColor,
			requested: new Set(),
			urls: new Set(),
		}
		sessionRef.current = session

		return () => {
			session.active = false
			for (const url of session.urls) URL.revokeObjectURL(url)
			sessionRef.current = null
		}
		// Capture the design and background for this modal opening.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	useEffect(() => {
		const session = sessionRef.current
		if (!open || !session || session.requested.has(variant)) return
		session.requested.add(variant)
		if (!session.svg) {
			setPreviews(current => ({
				...current,
				[variant]: { status: 'error' },
			}))
			return
		}

		exportSvgAsPngBlob(session.svg, {
			backgroundColor: session.backgroundColor,
			includeGridLines,
		})
			.then(blob => {
				if (!session.active) return
				const url = URL.createObjectURL(blob)
				session.urls.add(url)
				setPreviews(current => ({
					...current,
					[variant]: {
						status: 'ready',
						blob,
						url,
						filename: buildExportFilename(),
					},
				}))
			})
			.catch(() => {
				if (session.active) {
					setPreviews(current => ({
						...current,
						[variant]: { status: 'error' },
					}))
				}
			})
	}, [open, includeGridLines, variant])

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
		const session = sessionRef.current
		setPreviews(current => ({
			...current,
			[variant]: { ...exportState, shareError: undefined },
		}))
		try {
			await navigator.share({
				files: [file],
				title: 'My Kaleidoscope design',
			})
		} catch (error) {
			// AbortError just means the user cancelled the share sheet.
			if (error instanceof Error && error.name === 'AbortError') return
			if (!session?.active) return
			setPreviews(current => {
				const preview = current[variant]
				return preview?.status === 'ready' &&
					preview.url === exportState.url
					? {
							...current,
							[variant]: {
								...preview,
								shareError:
									'Sorry, sharing failed. You can try again or download your image instead.',
							},
						}
					: current
			})
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
