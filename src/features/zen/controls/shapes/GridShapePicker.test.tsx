import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useZenState } from '@/features/zen/state'
import {
	TestZenStateProvider,
	TestZenStateProvider as ZenStateProvider,
} from '@/test/TestZenStateProvider'
import { testContent } from '@/test/playerContent'
import { gridShapes, gridSizeOptions } from '@/domain/shapes'
import GridShapePicker from './GridShapePicker'

function Harness({ onSelected }: { onSelected?: () => void }) {
	const { paintShapeGroup, state, undo, redo } = useZenState()
	return (
		<>
			<button onClick={() => paintShapeGroup('0')}>Paint</button>
			<button onClick={undo}>Undo</button>
			<button onClick={redo}>Redo</button>
			<span data-testid="paint">
				{JSON.stringify(state.shapeGroupColors)}
			</span>
			<GridShapePicker onSelected={onSelected} />
		</>
	)
}

describe('GridShapePicker', () => {
	beforeEach(() => localStorage.clear())

	it('renders icon-only options with accessible names and selects Hexagon medium by default', () => {
		render(<GridShapePicker />, { wrapper: ZenStateProvider })
		expect(screen.getAllByRole('button')).toHaveLength(18)
		for (const { label } of gridShapes) {
			for (const size of gridSizeOptions) {
				const button = screen.getByRole('button', {
					name: `${label} (${size.label})`,
				})
				expect(button).toBeEnabled()
				expect(button.textContent).toBe('')
				expect(button.querySelector('svg')).toHaveAttribute(
					'aria-hidden',
					'true',
				)
				expect(button).toHaveAttribute('data-size', size.id)
			}
		}
		expect(
			screen.getByRole('button', { name: 'Hexagon (M)' }),
		).toHaveAttribute('aria-pressed', 'true')
	})

	it('offers only the shapes the player has unlocked', () => {
		render(
			<TestZenStateProvider
				content={{ ...testContent, unlockedShapes: ['hexagon'] }}
			>
				<GridShapePicker />
			</TestZenStateProvider>,
		)
		expect(screen.getAllByRole('button')).toHaveLength(3)
		expect(
			screen.getByRole('button', { name: 'Hexagon (M)' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Triangle (M)' }),
		).not.toBeInTheDocument()
	})

	it('switches immediately, closes via callback, and restores independent shape and size designs', async () => {
		const user = userEvent.setup()
		const onSelected = vi.fn()
		render(<Harness onSelected={onSelected} />, {
			wrapper: ZenStateProvider,
		})
		await user.click(screen.getByRole('button', { name: 'Paint' }))
		const original = screen.getByTestId('paint').textContent
		await user.click(screen.getByRole('button', { name: 'Hexagon (S)' }))
		expect(screen.getByTestId('paint')).toHaveTextContent('{}')
		await user.click(screen.getByRole('button', { name: 'Triangle (M)' }))
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Paint' }))
		await user.click(screen.getByRole('button', { name: 'Hexagon (M)' }))
		expect(screen.getByTestId('paint').textContent).toBe(original)
		await user.click(screen.getByRole('button', { name: 'Hexagon (S)' }))
		expect(screen.getByTestId('paint')).toHaveTextContent('{}')
		await user.click(screen.getByRole('button', { name: 'Triangle (M)' }))
		expect(screen.getByTestId('paint').textContent).toBe(original)
		expect(onSelected).toHaveBeenCalledTimes(5)
		await user.click(screen.getByRole('button', { name: 'Triangle (M)' }))
		expect(onSelected).toHaveBeenCalledTimes(5)
		await user.click(screen.getByRole('button', { name: 'Undo' }))
		expect(
			screen.getByRole('button', { name: 'Hexagon (S)' }),
		).toHaveAttribute('aria-pressed', 'true')
		await user.click(screen.getByRole('button', { name: 'Redo' }))
		expect(
			screen.getByRole('button', { name: 'Triangle (M)' }),
		).toHaveAttribute('aria-pressed', 'true')
	})
})
