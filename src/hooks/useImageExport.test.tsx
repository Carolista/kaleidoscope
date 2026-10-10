import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { RefObject } from 'react'
import { useImageExport } from './useImageExport'
import * as imageExportService from '../services/imageExportService'

vi.mock('../services/imageExportService', async () => {
	const actual = await vi.importActual<
		typeof import('../services/imageExportService')
	>('../services/imageExportService')
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
		})
	})
})
