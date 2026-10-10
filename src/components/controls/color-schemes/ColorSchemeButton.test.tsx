import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '@state/AppContext'
import ColorSchemeButton from './ColorSchemeButton'

describe('ColorSchemeButton', () => {
	it('opens the color palette modal (with the scheme picker) and closes it', async () => {
		const user = userEvent.setup()
		render(<ColorSchemeButton />, { wrapper: AppStateProvider })

		expect(
			screen.queryByRole('dialog', { name: 'Color Palette' }),
		).toBeNull()

		await user.click(
			screen.getByRole('button', {
				name: 'Select a different color palette',
			}),
		)

		expect(
			screen.getByRole('dialog', { name: 'Color Palette' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', {
				name: 'Select the Daytona color palette',
			}),
		).toBeInTheDocument()

		await user.click(
			screen.getByRole('button', {
				name: 'Close color palette selector',
			}),
		)

		await waitFor(() =>
			expect(
				screen.queryByRole('dialog', { name: 'Color Palette' }),
			).not.toBeInTheDocument(),
		)
	})

	it('closes automatically once a scheme is selected', async () => {
		const user = userEvent.setup()
		render(<ColorSchemeButton />, { wrapper: AppStateProvider })

		await user.click(
			screen.getByRole('button', {
				name: 'Select a different color palette',
			}),
		)
		await user.click(
			screen.getByRole('button', {
				name: 'Select the Daytona color palette',
			}),
		)

		await waitFor(() =>
			expect(
				screen.queryByRole('dialog', { name: 'Color Palette' }),
			).not.toBeInTheDocument(),
		)
	})
})
