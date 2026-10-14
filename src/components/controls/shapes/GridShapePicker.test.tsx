import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '@state/AppContext'
import { useAppState } from '@state/useAppState'
import { gridShapes } from '@data/gridShapes'
import { defaultGridSizes, gridSizeOptions } from '@data/gridSizes'
import { colorSchemes } from '@data/colorSchemes'
import { savePersistedState } from '@services/storageService'
import { getGroupIdsForShape } from '@utils/gridShapeRegistry'
import GridShapePicker from './GridShapePicker'

function Harness() {
	const { paintShapeGroup, state } = useAppState()
	return (
		<>
			<button onClick={() => paintShapeGroup('0,0')}>Paint</button>
			<button
				onClick={() =>
					paintShapeGroup(getGroupIdsForShape('pinwheel', 'sm')[0])
				}
			>
				Paint Pinwheel
			</button>
			<span data-testid="count">
				{Object.keys(state.shapeGroupColors).length}
			</span>
			<GridShapePicker />
		</>
	)
}

describe('GridShapePicker', () => {
	beforeEach(() => {
		localStorage.clear()
		savePersistedState({
			currentScheme: colorSchemes[0],
			currentColor: colorSchemes[0].colors[0],
			darkMode: true,
			showEditableArea: true,
			gridShape: 'hexagon',
			gridSizes: { ...defaultGridSizes },
			shapeGroupColors: {},
		})
	})
	it('renders each shape with size options and selects Hexagon medium by default', () => {
		render(<GridShapePicker />, { wrapper: AppStateProvider })
		const hexagon = screen.getByRole('button', { name: 'Hexagon (M)' })
		const triangle = screen.getByRole('button', { name: 'Triangle (M)' })
		expect(screen.getAllByRole('button')).toHaveLength(
			gridShapes.length * gridSizeOptions.length,
		)
		for (const { label } of gridShapes) {
			for (const { id: sizeId, label: sizeLabel } of gridSizeOptions) {
				const button = screen.getByRole('button', {
					name: `${label} (${sizeLabel})`,
				})
				expect(button).toBeEnabled()
				expect(button.textContent).toBe('')
				expect(button.querySelector('svg')).toHaveAttribute(
					'aria-hidden',
					'true',
				)
				expect(button).toHaveAttribute('data-size', sizeId)
			}
			expect(screen.queryByText(label)).not.toBeInTheDocument()
		}
		expect(hexagon).toHaveAttribute('aria-pressed', 'true')
		expect(triangle).toHaveAttribute('aria-pressed', 'false')
		expect(
			screen.getByRole('button', { name: 'Triangle (S)' }),
		).toBeEnabled()
		expect(
			screen.getByRole('button', { name: 'Diamond Star (L)' }),
		).toBeEnabled()
		expect(
			screen.getByRole('button', { name: 'Hexagram (S)' }),
		).toBeEnabled()
		expect(
			screen.getByRole('button', { name: 'Hexagram (L)' }),
		).toHaveAttribute('aria-pressed', 'false')
		expect(
			screen.getByRole('button', { name: 'Circle Rings (S)' }),
		).toBeEnabled()
		expect(
			screen.getByRole('button', { name: 'Circle Rings (L)' }),
		).toHaveAttribute('aria-pressed', 'false')
		expect(
			screen.getByRole('button', { name: 'Pinwheel (S)' }),
		).toBeEnabled()
	})

	it('clicking a different shape opens a confirmation dialog rather than switching immediately', async () => {
		const user = userEvent.setup()
		render(<GridShapePicker />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Triangle (M)' }))

		expect(
			screen.getByRole('dialog', { name: 'Confirm Shape Change' }),
		).toBeInTheDocument()
		// Not switched yet, since the dialog hasn't been confirmed.
		expect(
			screen.getByRole('button', { name: 'Hexagon (M)' }),
		).toHaveAttribute('aria-pressed', 'true')
	})

	it('confirming the dialog switches the shape and resets the design', async () => {
		const user = userEvent.setup()

		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Paint' }))
		expect(screen.getByTestId('count')).toHaveTextContent('1')

		await user.click(screen.getByRole('button', { name: 'Triangle (M)' }))
		await user.click(screen.getByRole('button', { name: 'Switch' }))

		expect(
			screen.getByRole('button', { name: 'Triangle (M)' }),
		).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByTestId('count')).toHaveTextContent('0')
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
	})

	it('canceling the dialog leaves the shape and design unchanged', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Paint' }))
		expect(screen.getByTestId('count')).toHaveTextContent('1')
		await user.click(screen.getByRole('button', { name: 'Triangle (M)' }))
		await user.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(
			screen.getByRole('button', { name: 'Hexagon (M)' }),
		).toHaveAttribute('aria-pressed', 'true')
		expect(
			screen.queryByRole('dialog', { name: 'Confirm Shape Change' }),
		).not.toBeInTheDocument()
		expect(screen.getByTestId('count')).toHaveTextContent('1')
	})

	it('calls onSelected once the switch is confirmed', async () => {
		const user = userEvent.setup()
		const onSelected = vi.fn()
		render(<GridShapePicker onSelected={onSelected} />, {
			wrapper: AppStateProvider,
		})

		await user.click(screen.getByRole('button', { name: 'Triangle (M)' }))
		expect(onSelected).not.toHaveBeenCalled()
		await user.click(screen.getByRole('button', { name: 'Switch' }))
		expect(onSelected).toHaveBeenCalledTimes(1)
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
	})

	it('does not select or remember the skip preference when a checked confirmation is canceled', async () => {
		const user = userEvent.setup()
		const onSelected = vi.fn()
		render(<GridShapePicker onSelected={onSelected} />, {
			wrapper: AppStateProvider,
		})
		await user.click(screen.getByRole('button', { name: 'Triangle (M)' }))
		await user.click(screen.getByRole('checkbox'))
		await user.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(onSelected).not.toHaveBeenCalled()
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

		await user.click(
			screen.getByRole('button', { name: 'Diamond Star (M)' }),
		)
		expect(
			screen.getByRole('dialog', { name: 'Confirm Shape Change' }),
		).toBeInTheDocument()
		expect(screen.getByRole('checkbox')).not.toBeChecked()
		expect(
			screen.getByRole('button', { name: 'Hexagon (M)' }),
		).toHaveAttribute('aria-pressed', 'true')
		expect(onSelected).not.toHaveBeenCalled()
	})

	it('skips the confirmation dialog on future clicks once "don\'t show this again" is checked and confirmed', async () => {
		const user = userEvent.setup()
		render(<GridShapePicker />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Triangle (M)' }))
		await user.click(
			screen.getByRole('checkbox', { name: "Don't show this again" }),
		)
		await user.click(screen.getByRole('button', { name: 'Switch' }))
		expect(
			screen.getByRole('button', { name: 'Triangle (M)' }),
		).toHaveAttribute('aria-pressed', 'true')

		// Switch back to hexagon with no dialog this time.
		await user.click(screen.getByRole('button', { name: 'Hexagon (M)' }))
		expect(
			screen.queryByRole('dialog', { name: 'Confirm Shape Change' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Hexagon (M)' }),
		).toHaveAttribute('aria-pressed', 'true')
	})

	it('clicking the already-current shape does not open a confirmation dialog', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Paint' }))
		await user.click(screen.getByRole('button', { name: 'Hexagon (M)' }))

		expect(
			screen.queryByRole('dialog', { name: 'Confirm Shape Change' }),
		).not.toBeInTheDocument()
		expect(screen.getByTestId('count')).toHaveTextContent('1')
	})

	it('changes the selected hexagon size directly and preserves its design', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Paint' }))
		await user.click(screen.getByRole('button', { name: 'Hexagon (S)' }))

		expect(
			screen.getByRole('button', { name: 'Hexagon (S)' }),
		).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByTestId('count')).toHaveTextContent('1')
		expect(
			screen.queryByRole('dialog', { name: 'Confirm Shape Change' }),
		).not.toBeInTheDocument()
	})

	it('changes the selected Circle Rings size directly and preserves shared paint', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(
			screen.getByRole('button', { name: 'Circle Rings (M)' }),
		)
		await user.click(screen.getByRole('button', { name: 'Switch' }))
		await user.click(screen.getByRole('button', { name: 'Paint Pinwheel' }))
		await user.click(
			screen.getByRole('button', { name: 'Circle Rings (S)' }),
		)

		expect(
			screen.getByRole('button', { name: 'Circle Rings (S)' }),
		).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByTestId('count')).toHaveTextContent('1')
		expect(
			screen.queryByRole('dialog', { name: 'Confirm Shape Change' }),
		).not.toBeInTheDocument()
	})

	it('changes the selected Pinwheel size directly and preserves shared paint', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Pinwheel (M)' }))
		await user.click(screen.getByRole('button', { name: 'Switch' }))
		await user.click(screen.getByRole('button', { name: 'Paint Pinwheel' }))
		await user.click(screen.getByRole('button', { name: 'Pinwheel (S)' }))

		expect(
			screen.getByRole('button', { name: 'Pinwheel (S)' }),
		).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByTestId('count')).toHaveTextContent('1')
		expect(
			screen.queryByRole('dialog', { name: 'Confirm Shape Change' }),
		).not.toBeInTheDocument()
	})

	it('switches to the selected Triangle size after confirmation', async () => {
		const user = userEvent.setup()
		const onSelected = vi.fn()
		render(<GridShapePicker onSelected={onSelected} />, {
			wrapper: AppStateProvider,
		})

		await user.click(screen.getByRole('button', { name: 'Triangle (S)' }))
		expect(onSelected).not.toHaveBeenCalled()
		await user.click(screen.getByRole('button', { name: 'Switch' }))

		expect(
			screen.getByRole('button', { name: 'Triangle (S)' }),
		).toHaveAttribute('aria-pressed', 'true')
		expect(onSelected).toHaveBeenCalledOnce()
	})
})
