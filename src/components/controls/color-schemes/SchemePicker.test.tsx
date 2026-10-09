import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '../../../state/AppContext'
import { colorSchemes } from '../../../data/colorSchemes'
import SchemePicker from './SchemePicker'
import ColorOptions from './ColorOptions'

describe('SchemePicker', () => {
	it('renders one button per color scheme', () => {
		render(<SchemePicker />, { wrapper: AppStateProvider })
		expect(screen.getAllByRole('button')).toHaveLength(colorSchemes.length)
	})

	it('marks exactly one scheme as pressed, and switches which one on click', async () => {
		const user = userEvent.setup()
		render(<SchemePicker />, { wrapper: AppStateProvider })

		const buttons = screen.getAllByRole('button')
		const pressedBefore = buttons.filter(
			button => button.getAttribute('aria-pressed') === 'true',
		)
		expect(pressedBefore).toHaveLength(1)

		// Pick any scheme other than the randomly-chosen initial one, so this
		// test is correct regardless of which scheme happened to start active.
		const target = buttons.find(button => button !== pressedBefore[0])!
		await user.click(target)

		expect(target).toHaveAttribute('aria-pressed', 'true')
		expect(pressedBefore[0]).toHaveAttribute('aria-pressed', 'false')
	})

	it('updates the available current-color swatches when a new scheme is selected', async () => {
		const user = userEvent.setup()
		function Harness() {
			return (
				<>
					<SchemePicker />
					<ColorOptions />
				</>
			)
		}
		render(<Harness />, { wrapper: AppStateProvider })

		const buttons = screen.getAllByRole('button')
		const pressedBefore = buttons.find(
			button => button.getAttribute('aria-pressed') === 'true',
		)!
		const target = buttons.find(button => button !== pressedBefore)!
		const targetName = target
			.getAttribute('aria-label')!
			.replace('Select the ', '')
			.replace(' color scheme', '')
		const targetScheme = colorSchemes.find(
			scheme => scheme.name === targetName,
		)!

		await user.click(target)

		// ColorOptions' first swatch should now be the new scheme's first
		// color, and it should be the newly-selected current color (per
		// SELECT_SCHEME).
		expect(screen.getByLabelText('Color 1')).toHaveStyle({
			backgroundColor: targetScheme.colors[0],
		})
		expect(screen.getByLabelText('Color 1')).toHaveAttribute(
			'aria-pressed',
			'true',
		)
	})
})
