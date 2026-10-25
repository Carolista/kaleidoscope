import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useZenState } from '@/features/zen/state'
import { testContent } from '@/test/playerContent'
import { TestZenStateProvider as ZenStateProvider } from '@/test/TestZenStateProvider'
import RandomizeDesignButton from './RandomizeDesignButton'

function Harness() {
	const { state } = useZenState()
	return (
		<>
			<span data-testid="painted-count">
				{Object.keys(state.shapeGroupColors).length}
			</span>
			<RandomizeDesignButton />
		</>
	)
}

describe('RandomizeDesignButton', () => {
	it('is not offered until the randomizer has been earned', () => {
		render(<RandomizeDesignButton />, {
			wrapper: ({ children }) => (
				<ZenStateProvider
					content={{ ...testContent, randomizerUnlocked: false }}
				>
					{children}
				</ZenStateProvider>
			),
		})
		expect(
			screen.queryByRole('button', { name: 'Generate a random design' }),
		).not.toBeInTheDocument()
	})

	it('generates a design (paints every group) with no confirmation needed', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: ZenStateProvider })

		expect(screen.getByTestId('painted-count')).toHaveTextContent('0')

		await user.click(
			screen.getByRole('button', { name: 'Generate a random design' }),
		)

		await waitFor(() =>
			expect(screen.getByTestId('painted-count')).toHaveTextContent('9'),
		)
	})
})
