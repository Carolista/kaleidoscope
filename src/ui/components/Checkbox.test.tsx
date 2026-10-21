import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { palettes, withLightness } from '@/domain/palettes'
import { useZenState } from '@/features/zen/state'
import { renderWithProvider } from '@/test/renderWithProvider'
import Checkbox from './Checkbox'

describe('Checkbox', () => {
	it('supports icon-only mixed and disabled selection without player state', async () => {
		const onChange = vi.fn()
		const { rerender } = render(
			<Checkbox
				plain
				hideLabel
				label="Select draft"
				checked={false}
				indeterminate
				onChange={onChange}
			/>,
		)
		const checkbox = screen.getByRole('checkbox', { name: 'Select draft' })
		expect(checkbox).toBePartiallyChecked()
		expect(screen.queryByText('Select draft')).not.toBeInTheDocument()
		const user = userEvent.setup()
		await user.click(checkbox)
		expect(onChange).toHaveBeenCalledWith(true)
		rerender(
			<Checkbox
				plain
				hideLabel
				label="Select draft"
				checked
				disabled
				onChange={onChange}
			/>,
		)
		expect(checkbox).toBeChecked()
		expect(checkbox).not.toBePartiallyChecked()
		expect(checkbox).toBeDisabled()
		await user.click(checkbox)
		expect(onChange).toHaveBeenCalledTimes(1)
	})
	beforeEach(() => localStorage.clear())

	it('toggles through its label and keyboard while keeping the icon decorative', async () => {
		const onChange = vi.fn()
		function Harness() {
			const [checked, setChecked] = useState(false)
			return (
				<Checkbox
					label="Include grid lines"
					checked={checked}
					className="placement"
					onChange={nextChecked => {
						onChange(nextChecked)
						setChecked(nextChecked)
					}}
				/>
			)
		}
		const { container } = renderWithProvider(<Harness />)
		const checkbox = screen.getByRole('checkbox', {
			name: 'Include grid lines',
		})
		expect(checkbox).not.toBeChecked()
		expect(container.querySelector('svg')).not.toBeInTheDocument()
		expect(checkbox.closest('label')).toHaveClass('placement')

		const user = userEvent.setup()
		await user.click(screen.getByText('Include grid lines'))
		expect(checkbox).toBeChecked()
		expect(onChange).toHaveBeenLastCalledWith(true)
		expect(container.querySelector('svg')).toHaveAttribute(
			'aria-hidden',
			'true',
		)
		expect(checkbox).toHaveFocus()

		await user.keyboard(' ')
		expect(checkbox).not.toBeChecked()
		expect(onChange).toHaveBeenLastCalledWith(false)
		expect(container.querySelector('svg')).not.toBeInTheDocument()
	})

	it('updates the checked icon tint with the current palette and theme', async () => {
		function Harness() {
			const { state, selectPalette, toggleDarkMode } = useZenState()
			return (
				<>
					<Checkbox
						label="Tinted checkbox"
						checked
						onChange={() => {}}
					/>
					<button onClick={() => selectPalette(palettes[1])}>
						Change palette
					</button>
					<button onClick={toggleDarkMode}>Change theme</button>
					<output>
						{withLightness(
							state.currentPalette.colors[0],
							state.darkMode ? 50 : 70,
						)}
					</output>
				</>
			)
		}
		const { container } = renderWithProvider(<Harness />)
		function expectCurrentTint() {
			const icon = container.querySelector('svg')!
			expect(icon.style.getPropertyValue('--fa-secondary-color')).toBe(
				screen.getByRole('status').textContent,
			)
			expect(icon.style.getPropertyValue('--fa-secondary-opacity')).toBe(
				'1',
			)
		}
		expectCurrentTint()
		const user = userEvent.setup()
		await user.click(screen.getByRole('button', { name: 'Change palette' }))
		expectCurrentTint()
		await user.click(screen.getByRole('button', { name: 'Change theme' }))
		expectCurrentTint()
	})
})
