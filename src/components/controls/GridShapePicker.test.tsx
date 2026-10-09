import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '../../state/AppContext'
import { useAppState } from '../../state/useAppState'
import GridShapePicker from './GridShapePicker'

describe('GridShapePicker', () => {
	beforeEach(() => {
		localStorage.clear()
	})
	it('renders one button per grid shape, with hexagon pressed by default', () => {
		render(<GridShapePicker />, { wrapper: AppStateProvider })
		const hexagon = screen.getByRole('button', { name: 'Hexagon' })
		const triangle = screen.getByRole('button', { name: 'Triangle' })
		expect(hexagon).toHaveAttribute('aria-pressed', 'true')
		expect(triangle).toHaveAttribute('aria-pressed', 'false')
	})

	it('clicking a different shape opens a confirmation dialog rather than switching immediately', async () => {
		const user = userEvent.setup()
		render(<GridShapePicker />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Triangle' }))

		expect(
			screen.getByRole('heading', { name: 'Switch grid shape?' }),
		).toBeInTheDocument()
		// Not switched yet, since the dialog hasn't been confirmed.
		expect(screen.getByRole('button', { name: 'Hexagon' })).toHaveAttribute(
			'aria-pressed',
			'true',
		)
	})

	it('confirming the dialog switches the shape and resets the design', async () => {
		const user = userEvent.setup()

		function Harness() {
			const { paintHexGroup, state } = useAppState()
			return (
				<>
					<button onClick={() => paintHexGroup('0,0')}>Paint</button>
					<span data-testid="count">
						{Object.keys(state.hexGroupColors).length}
					</span>
					<GridShapePicker />
				</>
			)
		}
		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Paint' }))
		expect(screen.getByTestId('count')).toHaveTextContent('1')

		await user.click(screen.getByRole('button', { name: 'Triangle' }))
		await user.click(screen.getByRole('button', { name: 'Switch' }))

		expect(
			screen.getByRole('button', { name: 'Triangle' }),
		).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByTestId('count')).toHaveTextContent('0')
	})

	it('canceling the dialog leaves the shape and design unchanged', async () => {
		const user = userEvent.setup()
		render(<GridShapePicker />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Triangle' }))
		await user.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(screen.getByRole('button', { name: 'Hexagon' })).toHaveAttribute(
			'aria-pressed',
			'true',
		)
		expect(
			screen.queryByRole('heading', { name: 'Switch grid shape?' }),
		).not.toBeInTheDocument()
	})

	it('calls onSelected once the switch is confirmed', async () => {
		const user = userEvent.setup()
		let selectedCount = 0
		render(<GridShapePicker onSelected={() => selectedCount++} />, {
			wrapper: AppStateProvider,
		})

		await user.click(screen.getByRole('button', { name: 'Triangle' }))
		expect(selectedCount).toBe(0)
		await user.click(screen.getByRole('button', { name: 'Switch' }))
		expect(selectedCount).toBe(1)
	})

	it('skips the confirmation dialog on future clicks once "don\'t show this again" is checked and confirmed', async () => {
		const user = userEvent.setup()
		render(<GridShapePicker />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Triangle' }))
		await user.click(
			screen.getByRole('checkbox', { name: "Don't show this again" }),
		)
		await user.click(screen.getByRole('button', { name: 'Switch' }))
		expect(
			screen.getByRole('button', { name: 'Triangle' }),
		).toHaveAttribute('aria-pressed', 'true')

		// Switch back to hexagon with no dialog this time.
		await user.click(screen.getByRole('button', { name: 'Hexagon' }))
		expect(
			screen.queryByRole('heading', { name: 'Switch grid shape?' }),
		).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Hexagon' })).toHaveAttribute(
			'aria-pressed',
			'true',
		)
	})

	it('clicking the already-current shape does not open a confirmation dialog', async () => {
		const user = userEvent.setup()
		render(<GridShapePicker />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Hexagon' }))

		expect(
			screen.queryByRole('heading', { name: 'Switch grid shape?' }),
		).not.toBeInTheDocument()
	})
})
