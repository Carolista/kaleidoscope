import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '@state/AppContext'
import { useAppState } from '@state/useAppState'
import { gridShapes } from '@data/gridShapes'
import { defaultGridSizes, gridSizeOptions } from '@data/gridSizes'
import { colorSchemes } from '@data/colorSchemes'
import { savePersistedState } from '@services/storageService'
import GridShapePicker from './GridShapePicker'

function Harness() {
	const { paintShapeGroup, state } = useAppState()
	return (
		<>
			<button onClick={() => paintShapeGroup('0,0')}>Paint</button>
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
	it('renders each shape with size options and selects Hexagon MD by default', () => {
		render(<GridShapePicker />, { wrapper: AppStateProvider })
		const hexagon = screen.getByRole('button', { name: 'Hexagon MD' })
		const triangle = screen.getByRole('button', { name: 'Triangle MD' })
		expect(screen.getAllByRole('button')).toHaveLength(
			gridShapes.length * gridSizeOptions.length,
		)
		for (const { label } of gridShapes) {
			for (const { label: sizeLabel } of gridSizeOptions) {
				expect(
					screen.getByRole('button', {
						name: `${label} ${sizeLabel}`,
					}),
				).toBeInTheDocument()
			}
		}
		expect(hexagon).toHaveAttribute('aria-pressed', 'true')
		expect(triangle).toHaveAttribute('aria-pressed', 'false')
		expect(
			screen.getByRole('button', { name: 'Circle Rings SM' }),
		).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Triangle SM' }),
		).toBeEnabled()
	})

	it('clicking a different shape opens a confirmation dialog rather than switching immediately', async () => {
		const user = userEvent.setup()
		render(<GridShapePicker />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Triangle MD' }))

		expect(
			screen.getByRole('dialog', { name: 'Confirm Shape Change' }),
		).toBeInTheDocument()
		// Not switched yet, since the dialog hasn't been confirmed.
		expect(
			screen.getByRole('button', { name: 'Hexagon MD' }),
		).toHaveAttribute('aria-pressed', 'true')
	})

	it('confirming the dialog switches the shape and resets the design', async () => {
		const user = userEvent.setup()

		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Paint' }))
		expect(screen.getByTestId('count')).toHaveTextContent('1')

		await user.click(screen.getByRole('button', { name: 'Triangle MD' }))
		await user.click(screen.getByRole('button', { name: 'Switch' }))

		expect(
			screen.getByRole('button', { name: 'Triangle MD' }),
		).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByTestId('count')).toHaveTextContent('0')
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
	})

	it('canceling the dialog leaves the shape and design unchanged', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Paint' }))
		expect(screen.getByTestId('count')).toHaveTextContent('1')
		await user.click(screen.getByRole('button', { name: 'Triangle MD' }))
		await user.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(
			screen.getByRole('button', { name: 'Hexagon MD' }),
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

		await user.click(screen.getByRole('button', { name: 'Triangle MD' }))
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
		await user.click(screen.getByRole('button', { name: 'Triangle MD' }))
		await user.click(screen.getByRole('checkbox'))
		await user.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(onSelected).not.toHaveBeenCalled()
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

		await user.click(
			screen.getByRole('button', { name: 'Diamond Star MD' }),
		)
		expect(
			screen.getByRole('dialog', { name: 'Confirm Shape Change' }),
		).toBeInTheDocument()
		expect(screen.getByRole('checkbox')).not.toBeChecked()
		expect(
			screen.getByRole('button', { name: 'Hexagon MD' }),
		).toHaveAttribute('aria-pressed', 'true')
		expect(onSelected).not.toHaveBeenCalled()
	})

	it('skips the confirmation dialog on future clicks once "don\'t show this again" is checked and confirmed', async () => {
		const user = userEvent.setup()
		render(<GridShapePicker />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Triangle MD' }))
		await user.click(
			screen.getByRole('checkbox', { name: "Don't show this again" }),
		)
		await user.click(screen.getByRole('button', { name: 'Switch' }))
		expect(
			screen.getByRole('button', { name: 'Triangle MD' }),
		).toHaveAttribute('aria-pressed', 'true')

		// Switch back to hexagon with no dialog this time.
		await user.click(screen.getByRole('button', { name: 'Hexagon MD' }))
		expect(
			screen.queryByRole('dialog', { name: 'Confirm Shape Change' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Hexagon MD' }),
		).toHaveAttribute('aria-pressed', 'true')
	})

	it('clicking the already-current shape does not open a confirmation dialog', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Paint' }))
		await user.click(screen.getByRole('button', { name: 'Hexagon MD' }))

		expect(
			screen.queryByRole('dialog', { name: 'Confirm Shape Change' }),
		).not.toBeInTheDocument()
		expect(screen.getByTestId('count')).toHaveTextContent('1')
	})

	it('changes the selected hexagon size directly and preserves its design', async () => {
		const user = userEvent.setup()
		render(<Harness />, { wrapper: AppStateProvider })

		await user.click(screen.getByRole('button', { name: 'Paint' }))
		await user.click(screen.getByRole('button', { name: 'Hexagon SM' }))

		expect(
			screen.getByRole('button', { name: 'Hexagon SM' }),
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

		await user.click(screen.getByRole('button', { name: 'Triangle SM' }))
		expect(onSelected).not.toHaveBeenCalled()
		await user.click(screen.getByRole('button', { name: 'Switch' }))

		expect(
			screen.getByRole('button', { name: 'Triangle SM' }),
		).toHaveAttribute('aria-pressed', 'true')
		expect(onSelected).toHaveBeenCalledOnce()
	})
})
