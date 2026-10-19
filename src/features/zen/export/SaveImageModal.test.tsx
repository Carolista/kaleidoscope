import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useImageExport } from './useImageExport'
import { renderWithProvider } from '@/test/renderWithProvider'
import SaveImageModal from './SaveImageModal'

vi.mock('./useImageExport')
const mockUseImageExport = vi.mocked(useImageExport)

describe('SaveImageModal', () => {
	const originalAnimate = Object.getOwnPropertyDescriptor(
		HTMLDialogElement.prototype,
		'animate',
	)

	afterEach(() => {
		if (originalAnimate) {
			Object.defineProperty(
				HTMLDialogElement.prototype,
				'animate',
				originalAnimate,
			)
		} else {
			Reflect.deleteProperty(HTMLDialogElement.prototype, 'animate')
		}
	})

	beforeEach(() => {
		mockUseImageExport.mockReset()
		localStorage.clear()
	})

	it('announces a share failure while keeping the preview and download available', async () => {
		const handleDownload = vi.fn()
		mockUseImageExport.mockReturnValue({
			exportState: {
				status: 'ready',
				blob: new Blob(['png'], { type: 'image/png' }),
				url: 'blob:preview',
				filename: 'design.png',
				shareError:
					'Sorry, sharing failed. You can try again or download your image instead.',
			},
			canShare: true,
			handleDownload,
			handleShare: vi.fn().mockResolvedValue(undefined),
		})
		renderWithProvider(
			<SaveImageModal
				open
				svgRef={{ current: null }}
				onClose={() => {}}
			/>,
		)

		expect(screen.getByRole('alert')).toHaveTextContent('sharing failed')
		expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:preview')
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Share' })).toBeEnabled()
		const download = screen.getByRole('button', { name: 'Download' })
		expect(download).toBeEnabled()
		await userEvent.setup().click(download)
		expect(handleDownload).toHaveBeenCalledOnce()
	})

	it('shows a generation error instead of a spinner and disables download', () => {
		mockUseImageExport.mockReturnValue({
			exportState: { status: 'error' },
			canShare: false,
			handleDownload: vi.fn(),
			handleShare: vi.fn().mockResolvedValue(undefined),
		})
		renderWithProvider(
			<SaveImageModal
				open
				svgRef={{ current: null }}
				onClose={() => {}}
			/>,
		)

		expect(
			screen.getByText(/something went wrong generating/),
		).toBeInTheDocument()
		expect(screen.queryByText('Generating image…')).not.toBeInTheDocument()
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
		expect(
			screen.queryByRole('button', { name: 'Share' }),
		).not.toBeInTheDocument()
	})

	it('allows repeated toggles while generating and remembers the choice in a new modal', async () => {
		mockUseImageExport.mockReturnValue({
			exportState: { status: 'generating' },
			canShare: false,
			handleDownload: vi.fn(),
			handleShare: vi.fn().mockResolvedValue(undefined),
		})
		const svgRef = { current: null }
		const { unmount } = renderWithProvider(
			<SaveImageModal open svgRef={svgRef} onClose={() => {}} />,
		)
		const toggle = screen.getByRole('checkbox', {
			name: 'Include grid lines',
		})
		const status = screen.getByRole('status')
		expect(status).toHaveTextContent('Generating image…')
		expect(
			within(status).getByRole('presentation', { hidden: true }),
		).toHaveAttribute('src', `${import.meta.env.BASE_URL}favicon.svg`)
		expect(toggle).toBeChecked()
		const user = userEvent.setup()
		for (const checked of [false, true, false]) {
			await user.click(toggle)
			expect(mockUseImageExport).toHaveBeenLastCalledWith(
				svgRef,
				true,
				expect.any(String),
				checked,
			)
		}
		expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
		unmount()

		renderWithProvider(
			<SaveImageModal open svgRef={svgRef} onClose={() => {}} />,
		)
		expect(
			screen.getByRole('checkbox', { name: 'Include grid lines' }),
		).not.toBeChecked()
		expect(mockUseImageExport).toHaveBeenLastCalledWith(
			svgRef,
			true,
			expect.any(String),
			false,
		)
	})

	it('keeps the export session alive until its closing animation finishes', () => {
		const animations: {
			cancel: () => void
			onfinish: (() => void) | null
		}[] = []
		Object.defineProperty(HTMLDialogElement.prototype, 'animate', {
			configurable: true,
			value: () => {
				const animation = {
					cancel: vi.fn(),
					onfinish: null as (() => void) | null,
				}
				animations.push(animation)
				return animation
			},
		})
		mockUseImageExport.mockReturnValue({
			exportState: {
				status: 'ready',
				blob: new Blob(['png']),
				url: 'blob:preview',
				filename: 'design.png',
			},
			canShare: false,
			handleDownload: vi.fn(),
			handleShare: vi.fn(),
		})
		const svgRef = { current: null }
		const { rerender } = renderWithProvider(
			<SaveImageModal open svgRef={svgRef} onClose={() => {}} />,
		)
		act(() => animations[0].onfinish?.())
		rerender(
			<SaveImageModal open={false} svgRef={svgRef} onClose={() => {}} />,
		)
		expect(mockUseImageExport).toHaveBeenLastCalledWith(
			svgRef,
			true,
			expect.any(String),
			true,
		)
		expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:preview')
		act(() => animations[1].onfinish?.())
		expect(mockUseImageExport).toHaveBeenLastCalledWith(
			svgRef,
			false,
			expect.any(String),
			true,
		)
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
	})
})
