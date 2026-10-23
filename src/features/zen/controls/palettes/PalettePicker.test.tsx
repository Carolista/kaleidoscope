import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestZenStateProvider as ZenStateProvider } from '@/test/TestZenStateProvider'
import { palettes, testContent } from '@/test/playerContent'
import { TestZenStateProvider } from '@/test/TestZenStateProvider'
import PalettePicker from './PalettePicker'
import ColorOptions from './ColorOptions'

describe('PalettePicker', () => {
	it('applies a palette immediately and invokes the containing dialog close callback', async () => {
		const user = userEvent.setup()
		const onSelected = vi.fn()
		render(<PalettePicker onSelected={onSelected} />, {
			wrapper: ZenStateProvider,
		})
		const target = screen
			.getAllByRole('button')
			.find(button => button.getAttribute('aria-pressed') === 'false')!
		await user.click(target)
		expect(target).toHaveAttribute('aria-pressed', 'true')
		expect(onSelected).toHaveBeenCalledOnce()
	})
	it('renders one button per color palette', () => {
		render(<PalettePicker />, { wrapper: ZenStateProvider })
		expect(screen.getAllByRole('button')).toHaveLength(palettes.length)
		for (const palette of palettes) {
			expect(
				screen.getByRole('button', {
					name: `Select the ${palette.name} color palette`,
				}),
			).toBeInTheDocument()
		}
	})

	it('offers only the palettes the player has', () => {
		render(
			<TestZenStateProvider
				content={{ ...testContent, palettes: palettes.slice(0, 2) }}
			>
				<PalettePicker />
			</TestZenStateProvider>,
		)
		expect(screen.getAllByRole('button')).toHaveLength(2)
		expect(
			screen.getByRole('button', {
				name: 'Select the Cabo color palette',
			}),
		).toBeInTheDocument()
	})

	it('marks exactly one palette as pressed, and switches which one on click', async () => {
		const user = userEvent.setup()
		render(<PalettePicker />, { wrapper: ZenStateProvider })

		const buttons = screen.getAllByRole('button')
		const pressedBefore = buttons.filter(
			button => button.getAttribute('aria-pressed') === 'true',
		)
		expect(pressedBefore).toHaveLength(1)

		// Pick any palette other than the randomly-chosen initial one, so this
		// test is correct regardless of which palette happened to start active.
		const target = buttons.find(button => button !== pressedBefore[0])!
		await user.click(target)

		expect(target).toHaveAttribute('aria-pressed', 'true')
		expect(pressedBefore[0]).toHaveAttribute('aria-pressed', 'false')
	})

	it('updates the available current-color swatches when a new palette is selected', async () => {
		const user = userEvent.setup()
		function Harness() {
			return (
				<>
					<PalettePicker />
					<ColorOptions />
				</>
			)
		}
		render(<Harness />, { wrapper: ZenStateProvider })

		const buttons = screen.getAllByRole('button')
		const pressedBefore = buttons.find(
			button => button.getAttribute('aria-pressed') === 'true',
		)!
		const target = buttons.find(button => button !== pressedBefore)!
		const targetName = target
			.getAttribute('aria-label')!
			.replace('Select the ', '')
			.replace(' color palette', '')
		const targetPalette = palettes.find(
			palette => palette.name === targetName,
		)!

		await user.click(target)

		// ColorOptions' first swatch should now be the new palette's first
		// color, and it should be the newly-selected current color (per
		// SELECT_PALETTE).
		expect(screen.getByLabelText('Color 1')).toHaveStyle({
			backgroundColor: targetPalette.colors[0],
		})
		expect(screen.getByLabelText('Color 1')).toHaveAttribute(
			'aria-pressed',
			'true',
		)
	})
})
