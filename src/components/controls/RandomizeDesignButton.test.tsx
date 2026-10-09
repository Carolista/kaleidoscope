import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '../../state/AppContext'
import { useAppState } from '../../state/useAppState'
import RandomizeDesignButton from './RandomizeDesignButton'

function Harness() {
	const { state } = useAppState()
	return (
		<>
			<span data-testid="painted-count">
				{Object.keys(state.hexGroupColors).length}
			</span>
			<RandomizeDesignButton />
		</>
	)
}

describe('RandomizeDesignButton', () => {
	it('generates a design (paints every group) with no confirmation needed', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: AppStateProvider })

		expect(screen.getByTestId('painted-count')).toHaveTextContent('0')

		await user.click(
			screen.getByRole('button', { name: 'Randomize design' }),
		)

		await waitFor(() =>
			expect(screen.getByTestId('painted-count')).toHaveTextContent('20'),
		)
	})
})
