import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '@state/AppContext'
import ColorThemeButton from './ColorThemeButton'

describe('ColorThemeButton', () => {
	it('opens the color theme modal (with the scheme picker) and closes it', async () => {
		const user = userEvent.setup()
		render(<ColorThemeButton />, { wrapper: AppStateProvider })

		expect(
			screen.queryByRole('heading', { name: 'Color Theme' }),
		).toBeNull()

		await user.click(
			screen.getByRole('button', {
				name: 'Select a different color palette',
			}),
		)

		expect(
			screen.getByRole('heading', { name: 'Color Theme' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', {
				name: 'Select the Daytona color scheme',
			}),
		).toBeInTheDocument()

		await user.click(
			screen.getByRole('button', {
				name: 'Close color palette selector',
			}),
		)

		await waitFor(() =>
			expect(
				screen.queryByRole('heading', { name: 'Color Theme' }),
			).not.toBeInTheDocument(),
		)
	})

	it('closes automatically once a scheme is selected', async () => {
		const user = userEvent.setup()
		render(<ColorThemeButton />, { wrapper: AppStateProvider })

		await user.click(
			screen.getByRole('button', {
				name: 'Select a different color palette',
			}),
		)
		await user.click(
			screen.getByRole('button', {
				name: 'Select the Daytona color scheme',
			}),
		)

		await waitFor(() =>
			expect(
				screen.queryByRole('heading', { name: 'Color Theme' }),
			).not.toBeInTheDocument(),
		)
	})
})
