import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProvider } from '../test/renderWithProvider'
import ColorOptions from './ColorOptions'

describe('ColorOptions', () => {
	it('renders 7 swatches: the 5 current-scheme colors plus base and accent', () => {
		renderWithProvider(<ColorOptions />)
		const swatches = screen.getAllByRole('button')
		expect(swatches).toHaveLength(7)
		expect(screen.getByLabelText('Base color')).toBeInTheDocument()
		expect(screen.getByLabelText('Accent color')).toBeInTheDocument()
	})

	it('marks exactly one swatch as pressed, and switches which one on click', async () => {
		const user = userEvent.setup()
		renderWithProvider(<ColorOptions />)

		const pressedBefore = screen
			.getAllByRole('button')
			.filter(button => button.getAttribute('aria-pressed') === 'true')
		expect(pressedBefore).toHaveLength(1)
		expect(pressedBefore[0]).toHaveAccessibleName('Color 1')

		await user.click(screen.getByLabelText('Color 2'))

		expect(screen.getByLabelText('Color 2')).toHaveAttribute(
			'aria-pressed',
			'true',
		)
		expect(screen.getByLabelText('Color 1')).toHaveAttribute(
			'aria-pressed',
			'false',
		)
	})
})
