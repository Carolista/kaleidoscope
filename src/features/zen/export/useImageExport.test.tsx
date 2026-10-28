import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { RefObject } from 'react'
import { useImageExport } from './useImageExport'
import * as imageExportService from './imageExportService'

vi.mock('./imageExportService', async () => {
	const actual = await vi.importActual<typeof import('./imageExportService')>(
		'./imageExportService',
	)
	return {
		...actual,
		exportSvgAsPngBlob: vi.fn(),
	}
})

const mockExportSvgAsPngBlob = vi.mocked(imageExportService.exportSvgAsPngBlob)

function svgRefWith(
	svg: SVGSVGElement | null,
): RefObject<SVGSVGElement | null> {
	return { current: svg }
}

function createSvg(): SVGSVGElement {
	return document.createElementNS(
		'http://www.w3.org/2000/svg',
		'svg',
	) as SVGSVGElement
}

const pngBlob = new Blob(['fake-png'], { type: 'image/png' })

beforeEach(() => {
	mockExportSvgAsPngBlob.mockReset()
	URL.createObjectURL = vi.fn(() => 'blob:fake-url')
	URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('useImageExport', () => {
	it('starts generating, then resolves to ready with a blob URL and filename', async () => {
		mockExportSvgAsPngBlob.mockResolvedValue(pngBlob)
		const { result } = renderHook(() =>
			useImageExport(svgRefWith(createSvg()), true, '#fff'),
		)

		expect(result.current.exportState.status).toBe('generating')

		await waitFor(() =>
			expect(result.current.exportState.status).toBe('ready'),
		)
		expect(result.current.exportState).toMatchObject({
			status: 'ready',
			blob: pngBlob,
			url: 'blob:fake-url',
		})
	})

	it('does not generate an image while the modal is closed', () => {
		const { result } = renderHook(() =>
			useImageExport(svgRefWith(null), false, '#fff'),
		)
		expect(result.current.exportState.status).toBe('generating')
		expect(mockExportSvgAsPngBlob).not.toHaveBeenCalled()
	})

	it('surfaces an error when opened without an SVG', () => {
		const { result } = renderHook(() =>
			useImageExport(svgRefWith(null), true, '#fff'),
		)
		expect(result.current.exportState.status).toBe('error')
		expect(mockExportSvgAsPngBlob).not.toHaveBeenCalled()
	})

	it.each(['close', 'unmount'])(
		'ignores generation completing after %s',
		async action => {
			let resolveExport!: (blob: Blob) => void
			mockExportSvgAsPngBlob.mockReturnValue(
				new Promise(resolve => {
					resolveExport = resolve
				}),
			)
			const { result, rerender, unmount } = renderHook(
				({ open }) =>
					useImageExport(svgRefWith(createSvg()), open, '#fff'),
				{ initialProps: { open: true } },
			)
			if (action === 'close') rerender({ open: false })
			else unmount()

			await act(async () => resolveExport(pngBlob))

			expect(URL.createObjectURL).not.toHaveBeenCalled()
			expect(result.current.exportState.status).toBe('generating')
		},
	)

	it('surfaces an error state when generation fails', async () => {
		mockExportSvgAsPngBlob.mockRejectedValue(new Error('boom'))
		const { result } = renderHook(() =>
			useImageExport(svgRefWith(createSvg()), true, '#fff'),
		)

		await waitFor(() =>
			expect(result.current.exportState.status).toBe('error'),
		)
	})

	it('revokes the blob URL once a new one replaces it', async () => {
		mockExportSvgAsPngBlob.mockResolvedValue(pngBlob)
		const { result, rerender } = renderHook(
			({ open }) => useImageExport(svgRefWith(createSvg()), open, '#fff'),
			{ initialProps: { open: true } },
		)
		await waitFor(() =>
			expect(result.current.exportState.status).toBe('ready'),
		)

		mockExportSvgAsPngBlob.mockResolvedValue(
			new Blob(['other'], { type: 'image/png' }),
		)
		rerender({ open: false })
		rerender({ open: true })

		await waitFor(() =>
			expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url'),
		)
	})

	it('generates each variant once and downloads the selected cached PNG', async () => {
		const withoutLinesBlob = new Blob(['without-lines'], {
			type: 'image/png',
		})
		mockExportSvgAsPngBlob
			.mockResolvedValueOnce(pngBlob)
			.mockResolvedValueOnce(withoutLinesBlob)
		vi.mocked(URL.createObjectURL)
			.mockReturnValueOnce('blob:with-lines')
			.mockReturnValueOnce('blob:without-lines')
		const svgRef = svgRefWith(createSvg())
		const { result, rerender, unmount } = renderHook(
			({ includeGridLines }) =>
				useImageExport(svgRef, true, '#fff', includeGridLines),
			{ initialProps: { includeGridLines: true } },
		)
		await waitFor(() =>
			expect(result.current.exportState).toMatchObject({
				url: 'blob:with-lines',
			}),
		)
		rerender({ includeGridLines: false })
		expect(result.current.exportState.status).toBe('generating')
		await waitFor(() =>
			expect(result.current.exportState).toMatchObject({
				url: 'blob:without-lines',
				blob: withoutLinesBlob,
			}),
		)
		expect(mockExportSvgAsPngBlob).toHaveBeenNthCalledWith(
			1,
			svgRef.current,
			{
				backgroundColor: '#fff',
				transparent: false,
				includeGridLines: true,
			},
		)
		expect(mockExportSvgAsPngBlob).toHaveBeenNthCalledWith(
			2,
			svgRef.current,
			{
				backgroundColor: '#fff',
				transparent: false,
				includeGridLines: false,
			},
		)
		for (const includeGridLines of [true, false, true, false]) {
			rerender({ includeGridLines })
			expect(result.current.exportState).toMatchObject({
				url: includeGridLines
					? 'blob:with-lines'
					: 'blob:without-lines',
			})
		}
		expect(mockExportSvgAsPngBlob).toHaveBeenCalledTimes(2)
		expect(URL.revokeObjectURL).not.toHaveBeenCalled()
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, 'click')
			.mockImplementation(function (this: HTMLAnchorElement) {
				expect(this.href).toBe('blob:without-lines')
				expect(this.download).toMatch(/^kaleidoscope-.*\.png$/)
			})
		act(() => result.current.handleDownload())
		expect(click).toHaveBeenCalledOnce()
		unmount()
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:with-lines')
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:without-lines')
		expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
	})

	it('caches a separate transparent variant and passes the transparent flag', async () => {
		const transparentBlob = new Blob(['transparent'], {
			type: 'image/png',
		})
		mockExportSvgAsPngBlob
			.mockResolvedValueOnce(pngBlob)
			.mockResolvedValueOnce(transparentBlob)
		vi.mocked(URL.createObjectURL)
			.mockReturnValueOnce('blob:opaque')
			.mockReturnValueOnce('blob:transparent')
		const svgRef = svgRefWith(createSvg())
		const { result, rerender } = renderHook(
			({ transparent }) =>
				useImageExport(svgRef, true, '#fff', true, transparent),
			{ initialProps: { transparent: false } },
		)
		await waitFor(() =>
			expect(result.current.exportState).toMatchObject({
				url: 'blob:opaque',
			}),
		)
		rerender({ transparent: true })
		await waitFor(() =>
			expect(result.current.exportState).toMatchObject({
				url: 'blob:transparent',
			}),
		)
		expect(mockExportSvgAsPngBlob).toHaveBeenNthCalledWith(
			2,
			svgRef.current,
			{
				backgroundColor: '#fff',
				transparent: true,
				includeGridLines: true,
			},
		)
		rerender({ transparent: false })
		expect(result.current.exportState).toMatchObject({
			url: 'blob:opaque',
		})
		expect(mockExportSvgAsPngBlob).toHaveBeenCalledTimes(2)
	})

	it('reuses in-flight generation and never shows a late result for the other variant', async () => {
		let resolveWithLines!: (blob: Blob) => void
		let resolveWithoutLines!: (blob: Blob) => void
		mockExportSvgAsPngBlob
			.mockReturnValueOnce(
				new Promise(resolve => {
					resolveWithLines = resolve
				}),
			)
			.mockReturnValueOnce(
				new Promise(resolve => {
					resolveWithoutLines = resolve
				}),
			)
		vi.mocked(URL.createObjectURL)
			.mockReturnValueOnce('blob:without-lines')
			.mockReturnValueOnce('blob:with-lines')
		const { result, rerender } = renderHook(
			({ includeGridLines }) =>
				useImageExport(
					svgRefWith(createSvg()),
					true,
					'#fff',
					includeGridLines,
				),
			{ initialProps: { includeGridLines: true } },
		)
		rerender({ includeGridLines: false })
		rerender({ includeGridLines: true })
		rerender({ includeGridLines: false })
		await act(async () => resolveWithoutLines(pngBlob))
		await act(async () => resolveWithLines(pngBlob))
		expect(result.current.exportState).toMatchObject({
			url: 'blob:without-lines',
		})
		rerender({ includeGridLines: true })
		expect(result.current.exportState).toMatchObject({
			url: 'blob:with-lines',
		})
		expect(mockExportSvgAsPngBlob).toHaveBeenCalledTimes(2)
	})

	it('discards both previews on close and exports the current design when reopened', async () => {
		mockExportSvgAsPngBlob.mockResolvedValue(pngBlob)
		vi.mocked(URL.createObjectURL)
			.mockReturnValueOnce('blob:with-lines')
			.mockReturnValueOnce('blob:without-lines')
		const svgRef = svgRefWith(createSvg())
		const { result, rerender } = renderHook(
			({ open, includeGridLines, backgroundColor }) =>
				useImageExport(svgRef, open, backgroundColor, includeGridLines),
			{
				initialProps: {
					open: true,
					includeGridLines: true,
					backgroundColor: '#fff',
				},
			},
		)
		await waitFor(() =>
			expect(result.current.exportState.status).toBe('ready'),
		)
		rerender({
			open: true,
			includeGridLines: false,
			backgroundColor: '#fff',
		})
		await waitFor(() =>
			expect(result.current.exportState.status).toBe('ready'),
		)
		rerender({
			open: false,
			includeGridLines: false,
			backgroundColor: '#fff',
		})
		expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
		svgRef.current = createSvg()
		rerender({
			open: true,
			includeGridLines: false,
			backgroundColor: '#222',
		})
		expect(result.current.exportState.status).toBe('generating')
		await waitFor(() =>
			expect(result.current.exportState.status).toBe('ready'),
		)
		expect(mockExportSvgAsPngBlob).toHaveBeenLastCalledWith(
			svgRef.current,
			{
				backgroundColor: '#222',
				transparent: false,
				includeGridLines: false,
			},
		)
		expect(mockExportSvgAsPngBlob).toHaveBeenCalledTimes(3)
	})

	it('clicks a temporary download link with the generated url/filename', async () => {
		mockExportSvgAsPngBlob.mockResolvedValue(pngBlob)
		const { result } = renderHook(() =>
			useImageExport(svgRefWith(createSvg()), true, '#fff'),
		)
		await waitFor(() =>
			expect(result.current.exportState.status).toBe('ready'),
		)

		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click')
		act(() => result.current.handleDownload())

		expect(clickSpy).toHaveBeenCalledOnce()
	})

	it('does nothing on download/share while not ready', () => {
		const { result } = renderHook(() =>
			useImageExport(svgRefWith(null), true, '#fff'),
		)
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click')
		act(() => result.current.handleDownload())
		expect(clickSpy).not.toHaveBeenCalled()
		expect(result.current.canShare).toBe(false)
	})

	describe('sharing', () => {
		const originalShare = navigator.share
		const originalCanShare = navigator.canShare

		afterEach(() => {
			Object.assign(navigator, {
				share: originalShare,
				canShare: originalCanShare,
			})
		})

		it('reports canShare true and calls navigator.share when supported', async () => {
			mockExportSvgAsPngBlob.mockResolvedValue(pngBlob)
			const share = vi.fn().mockResolvedValue(undefined)
			Object.assign(navigator, {
				share,
				canShare: vi.fn(() => true),
			})

			const { result } = renderHook(() =>
				useImageExport(svgRefWith(createSvg()), true, '#fff'),
			)
			await waitFor(() => expect(result.current.canShare).toBe(true))

			await act(() => result.current.handleShare())
			expect(share).toHaveBeenCalledOnce()
			expect(share.mock.calls[0][0].files[0]).toMatchObject({
				type: 'image/png',
				size: pngBlob.size,
			})
		})

		it('shares the selected line-free PNG after toggling from the lined preview', async () => {
			const withoutLinesBlob = new Blob(['line-free-png'], {
				type: 'image/png',
			})
			mockExportSvgAsPngBlob
				.mockResolvedValueOnce(pngBlob)
				.mockResolvedValueOnce(withoutLinesBlob)
			const share = vi.fn().mockResolvedValue(undefined)
			Object.assign(navigator, {
				share,
				canShare: vi.fn(() => true),
			})
			const { result, rerender } = renderHook(
				({ includeGridLines }) =>
					useImageExport(
						svgRefWith(createSvg()),
						true,
						'#fff',
						includeGridLines,
					),
				{ initialProps: { includeGridLines: true } },
			)
			await waitFor(() => expect(result.current.canShare).toBe(true))
			rerender({ includeGridLines: false })
			expect(result.current.canShare).toBe(false)
			await waitFor(() => expect(result.current.canShare).toBe(true))

			await act(() => result.current.handleShare())
			expect(share.mock.calls[0][0].files[0]).toMatchObject({
				type: 'image/png',
				size: withoutLinesBlob.size,
			})
		})

		it('swallows an AbortError from a cancelled share sheet', async () => {
			mockExportSvgAsPngBlob.mockResolvedValue(pngBlob)
			const abortError = Object.assign(new Error('cancelled'), {
				name: 'AbortError',
			})
			Object.assign(navigator, {
				share: vi.fn().mockRejectedValue(abortError),
				canShare: vi.fn(() => true),
			})

			const { result } = renderHook(() =>
				useImageExport(svgRefWith(createSvg()), true, '#fff'),
			)
			await waitFor(() =>
				expect(result.current.exportState.status).toBe('ready'),
			)

			await expect(
				act(() => result.current.handleShare()),
			).resolves.not.toThrow()
			expect(result.current.exportState).not.toHaveProperty(
				'shareError',
				expect.any(String),
			)
		})

		it('surfaces a share error while keeping the image ready, and clears it on retry', async () => {
			mockExportSvgAsPngBlob.mockResolvedValue(pngBlob)
			const otherError = new Error('network down')
			Object.assign(navigator, {
				share: vi.fn().mockRejectedValue(otherError),
				canShare: vi.fn(() => true),
			})

			const { result } = renderHook(() =>
				useImageExport(svgRefWith(createSvg()), true, '#fff'),
			)
			await waitFor(() =>
				expect(result.current.exportState.status).toBe('ready'),
			)

			await act(() => result.current.handleShare())
			expect(result.current.exportState).toMatchObject({
				status: 'ready',
				blob: pngBlob,
				url: 'blob:fake-url',
				shareError: expect.stringContaining('sharing failed'),
			})
			expect(result.current.canShare).toBe(true)
			const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click')
			act(() => result.current.handleDownload())
			expect(clickSpy).toHaveBeenCalledOnce()

			Object.assign(navigator, {
				share: vi.fn().mockResolvedValue(undefined),
			})
			await act(() => result.current.handleShare())
			expect(result.current.exportState).toMatchObject({
				status: 'ready',
				shareError: undefined,
			})
			expect(URL.revokeObjectURL).not.toHaveBeenCalled()
		})
	})
})
