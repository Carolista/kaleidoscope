import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '../../state/AppContext'
import { useAppState } from '../../state/useAppState'
import ResetDesignButton from './ResetDesignButton'

// Paints one hex group so we can observe whether reset actually clears it.
function Harness() {
	const { state, paintHexGroup } = useAppState()
	return (
		<>
			<button onClick={() => paintHexGroup('0,0')}>
				Paint test group
			</button>
			<span data-testid="painted-count">
				{Object.keys(state.hexGroupColors).length}
			</span>
			<ResetDesignButton />
		</>
	)
}

describe('ResetDesignButton', () => {
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
})
