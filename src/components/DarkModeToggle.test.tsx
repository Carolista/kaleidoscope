import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '../state/AppContext'
import DarkModeToggle from './DarkModeToggle'

describe('DarkModeToggle', () => {
	it('labels itself with the destination mode, and flips the label on click', async () => {
		const user = userEvent.setup()
		render(<DarkModeToggle />, { wrapper: AppStateProvider })

		const button = screen.getByRole('button')
		expect(button).toHaveTextContent('Light Mode')
		// The label describes the action's destination, not current state, so
		// aria-pressed (which describes current state) is intentionally absent.
		expect(button).not.toHaveAttribute('aria-pressed')

		await user.click(button)
		expect(button).toHaveTextContent('Dark Mode')

		await user.click(button)
		expect(button).toHaveTextContent('Light Mode')
	})
})
