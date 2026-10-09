import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '../../state/AppContext'
import { useAppState } from '../../state/useAppState'
import ResetDesignButton from './ResetDesignButton'

// Paints one group so we can observe whether reset actually clears it.
function Harness() {
	const { state, paintShapeGroup } = useAppState()
	return (
		<>
			<button onClick={() => paintShapeGroup('0,0')}>
				Paint test group
			</button>
			<span data-testid="painted-count">
				{Object.keys(state.shapeGroupColors).length}
			</span>
			<ResetDesignButton />
		</>
	)
}

describe('ResetDesignButton', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('asks for confirmation before resetting, and does nothing on cancel', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByText('Paint test group'))
		expect(screen.getByTestId('painted-count')).toHaveTextContent('1')

		await user.click(screen.getByRole('button', { name: 'Reset design' }))
		expect(
			screen.getByRole('heading', { name: 'Reset design?' }),
		).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'Cancel' }))
		await waitFor(() =>
			expect(
				screen.queryByRole('heading', { name: 'Reset design?' }),
			).not.toBeInTheDocument(),
		)
		expect(screen.getByTestId('painted-count')).toHaveTextContent('1')
	})

	it('clears the design on confirm', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByText('Paint test group'))
		await user.click(screen.getByRole('button', { name: 'Reset design' }))
		await user.click(screen.getByRole('button', { name: 'Reset' }))

		await waitFor(() =>
			expect(screen.getByTestId('painted-count')).toHaveTextContent('0'),
		)
	})

	it('skips the confirmation on future clicks once "don\'t show this again" is checked and confirmed', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByText('Paint test group'))
		await user.click(screen.getByRole('button', { name: 'Reset design' }))
		await user.click(
			screen.getByRole('checkbox', { name: "Don't show this again" }),
		)
		await user.click(screen.getByRole('button', { name: 'Reset' }))

		await waitFor(() =>
			expect(screen.getByTestId('painted-count')).toHaveTextContent('0'),
		)

		await user.click(screen.getByText('Paint test group'))
		await user.click(screen.getByRole('button', { name: 'Reset design' }))

		// No dialog this time; the reset happens immediately.
		expect(
			screen.queryByRole('heading', { name: 'Reset design?' }),
		).not.toBeInTheDocument()
		await waitFor(() =>
			expect(screen.getByTestId('painted-count')).toHaveTextContent('0'),
		)
	})
})
