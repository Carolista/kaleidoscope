import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '@state/AppContext'
import GridShapeButton from './GridShapeButton'

describe('GridShapeButton', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('opens the grid shape modal (with the shape picker) and closes it', async () => {
		const user = userEvent.setup()
		render(<GridShapeButton />, { wrapper: AppStateProvider })

		expect(screen.queryByRole('heading', { name: 'Grid Shape' })).toBeNull()

		await user.click(
			screen.getByRole('button', { name: 'Select a different shape' }),
		)

		expect(
			screen.getByRole('heading', { name: 'Grid Shape' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Hexagon' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Triangle' }),
		).toBeInTheDocument()

		await user.click(
			screen.getByRole('button', { name: 'Close grid shape selector' }),
		)

		await waitFor(() =>
			expect(
				screen.queryByRole('heading', { name: 'Grid Shape' }),
			).not.toBeInTheDocument(),
		)
	})

	it('closes automatically once a shape switch is confirmed', async () => {
		const user = userEvent.setup()
		render(<GridShapeButton />, { wrapper: AppStateProvider })

		await user.click(
			screen.getByRole('button', { name: 'Select a different shape' }),
		)
		await user.click(screen.getByRole('button', { name: 'Triangle' }))
		await user.click(screen.getByRole('button', { name: 'Switch' }))

		await waitFor(() =>
			expect(
				screen.queryByRole('heading', { name: 'Grid Shape' }),
			).not.toBeInTheDocument(),
		)
	})
})
