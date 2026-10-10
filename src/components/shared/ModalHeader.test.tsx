import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useImageExport } from '@hooks/useImageExport'
import { renderWithProvider } from '@test/renderWithProvider'
import ControlsModal from '../controls/ControlsModal'
import SaveImageModal from '../controls/SaveImageModal'
import ColorSchemeModal from '../controls/color-schemes/ColorSchemeModal'
import GridShapeModal from '../controls/shapes/GridShapeModal'

vi.mock('@hooks/useImageExport')

const modals = [
	{
		Component: ControlsModal,
		title: 'Controls',
		closeLabel: 'Close controls help',
	},
	{
		Component: ColorSchemeModal,
		title: 'Color Palette',
		closeLabel: 'Close color palette selector',
	},
	{
		Component: GridShapeModal,
		title: 'Grid Shape',
		closeLabel: 'Close grid shape selector',
	},
	{ Component: SaveImageModal, title: 'Save Image', closeLabel: 'Close' },
]

describe('shared modal headers', () => {
	beforeEach(() => {
		localStorage.clear()
		vi.mocked(useImageExport).mockReturnValue({
			exportState: { status: 'generating' },
			canShare: false,
			handleDownload: vi.fn(),
			handleShare: vi.fn().mockResolvedValue(undefined),
		})
	})

	it.each(modals)(
		'$title retains its accessible title and close action',
		async ({ Component, title, closeLabel }) => {
			const onClose = vi.fn()
			renderWithProvider(
				<Component open onClose={onClose} svgRef={{ current: null }} />,
			)
			const dialog = screen.getByRole('dialog', { name: title })
			const heading = within(dialog).getByRole('heading', {
				level: 2,
				name: title,
			})
			expect(dialog).toHaveAttribute('aria-labelledby', heading.id)
			await userEvent.setup().click(
				within(dialog).getByRole('button', {
					name: closeLabel,
				}),
			)
			expect(onClose).toHaveBeenCalledTimes(1)
		},
	)

	it.each(modals)(
		'$title instances reference their own unique headings',
		({ Component, title }) => {
			renderWithProvider(
				<>
					<Component
						open
						onClose={() => {}}
						svgRef={{ current: null }}
					/>
					<Component
						open
						onClose={() => {}}
						svgRef={{ current: null }}
					/>
				</>,
			)
			const dialogs = screen.getAllByRole('dialog', { name: title })
			expect(dialogs).toHaveLength(2)
			const ids = dialogs.map(dialog =>
				dialog.getAttribute('aria-labelledby'),
			)
			expect(new Set(ids).size).toBe(2)
			for (const dialog of dialogs) {
				const heading = within(dialog).getByRole('heading', {
					level: 2,
					name: title,
				})
				expect(dialog).toHaveAttribute('aria-labelledby', heading.id)
			}
		},
	)
})
