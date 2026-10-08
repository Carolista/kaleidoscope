import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '../../state/AppContext'
import { useAppState } from '../../state/useAppState'
import UndoRedoButtons from './UndoRedoButtons'

function Harness() {
	const { state, paintHexGroup } = useAppState()
	return (
		<>
			<button onClick={() => paintHexGroup('0,0')}>Paint</button>
			<span data-testid="painted-count">
				{Object.keys(state.hexGroupColors).length}
			</span>
			<UndoRedoButtons />
		</>
	)
}

describe('UndoRedoButtons', () => {
	// Each test starts a fresh design; without this, a design painted and
	// persisted by one test would leak into the next test's initial state.
	beforeEach(() => {
		localStorage.clear()
	})

	it('disables both buttons when there is no history yet', () => {
		render(<Harness />, { wrapper: AppStateProvider })
		expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
	})

	it('undoes and redoes a paint action via the buttons', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByText('Paint'))
		expect(screen.getByTestId('painted-count')).toHaveTextContent('1')

		await user.click(screen.getByRole('button', { name: 'Undo' }))
		expect(screen.getByTestId('painted-count')).toHaveTextContent('0')
		expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()

		await user.click(screen.getByRole('button', { name: 'Redo' }))
		expect(screen.getByTestId('painted-count')).toHaveTextContent('1')
		expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
	})

	it('undoes and redoes via keyboard shortcuts', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByText('Paint'))
		expect(screen.getByTestId('painted-count')).toHaveTextContent('1')

		await user.keyboard('{Control>}z{/Control}')
		expect(screen.getByTestId('painted-count')).toHaveTextContent('0')

		await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
		expect(screen.getByTestId('painted-count')).toHaveTextContent('1')
	})
})
