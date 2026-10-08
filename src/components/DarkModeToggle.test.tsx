import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '../state/AppContext'
import DarkModeToggle from './DarkModeToggle'

describe('DarkModeToggle', () => {
	it('labels itself with the destination mode, and flips the label/icon on click', async () => {
		const user = userEvent.setup()
		render(<DarkModeToggle />, { wrapper: AppStateProvider })

		// App defaults to dark mode, so the destination is light mode.
		const button = screen.getByRole('button', {
			name: 'Switch to light mode',
		})
		// The label describes the action's destination, not current state, so
		// aria-pressed (which describes current state) is intentionally absent.
		expect(button).not.toHaveAttribute('aria-pressed')

		await user.click(button)
		expect(
			screen.getByRole('button', { name: 'Switch to dark mode' }),
		).toBeInTheDocument()

		await user.click(screen.getByRole('button'))
		expect(
			screen.getByRole('button', { name: 'Switch to light mode' }),
		).toBeInTheDocument()
	})
})
