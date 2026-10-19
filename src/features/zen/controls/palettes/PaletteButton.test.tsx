import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ZenStateProvider } from '@/features/zen/state'
import PaletteButton from './PaletteButton'

describe('PaletteButton', () => {
	it('opens the color palette modal (with the palette picker) and closes it', async () => {
		const user = userEvent.setup()
		render(<PaletteButton />, { wrapper: ZenStateProvider })

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

	it('closes automatically once a palette is selected', async () => {
		const user = userEvent.setup()
		render(<PaletteButton />, { wrapper: ZenStateProvider })

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
