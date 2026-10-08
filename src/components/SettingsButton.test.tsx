import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '../state/AppContext'
import SettingsButton from './SettingsButton'

describe('SettingsButton', () => {
	it('opens the settings modal (with the theme picker and dark mode toggle) and closes it', async () => {
		const user = userEvent.setup()
		render(<SettingsButton />, { wrapper: AppStateProvider })

		expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull()

		await user.click(screen.getByRole('button', { name: 'Open settings' }))

		expect(
			screen.getByRole('heading', { name: 'Settings' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', {
				name: 'Select the Daytona color scheme',
			}),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Light Mode' }),
		).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'Close settings' }))

		await waitFor(() =>
			expect(
				screen.queryByRole('heading', { name: 'Settings' }),
			).not.toBeInTheDocument(),
		)
	})
})
