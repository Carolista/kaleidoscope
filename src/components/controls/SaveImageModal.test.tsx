import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useImageExport } from '@hooks/useImageExport'
import { renderWithProvider } from '@test/renderWithProvider'
import SaveImageModal from './SaveImageModal'

vi.mock('@hooks/useImageExport')
const mockUseImageExport = vi.mocked(useImageExport)

describe('SaveImageModal', () => {
	beforeEach(() => {
		mockUseImageExport.mockReset()
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
		expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
		expect(
			screen.queryByRole('button', { name: 'Share' }),
		).not.toBeInTheDocument()
	})
})
