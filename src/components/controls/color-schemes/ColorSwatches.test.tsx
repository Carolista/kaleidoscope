import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ColorSwatches from './ColorSwatches'

const OPTIONS = [
	{ color: '#111111', label: 'Color 1' },
	{ color: '#222222', label: 'Color 2' },
	{ color: '#333333', label: 'Color 3' },
]

describe('ColorSwatches', () => {
	it('marks only the selected color as pressed', () => {
		render(
			<ColorSwatches
				options={OPTIONS}
				selectedColor="#222222"
				onSelect={vi.fn()}
			/>,
		)
		expect(screen.getByLabelText('Color 2')).toHaveAttribute(
			'aria-pressed',
			'true',
		)
		expect(screen.getByLabelText('Color 1')).toHaveAttribute(
			'aria-pressed',
			'false',
		)
	})

	it('disables listed colors, which cannot be selected', async () => {
		const onSelect = vi.fn()
		const user = userEvent.setup()
		render(
			<ColorSwatches
				options={OPTIONS}
				selectedColor={null}
				disabledColors={['#111111']}
				onSelect={onSelect}
			/>,
		)

		expect(screen.getByLabelText('Color 1')).toBeDisabled()
		await user.click(screen.getByLabelText('Color 1'))
		expect(onSelect).not.toHaveBeenCalled()

		await user.click(screen.getByLabelText('Color 3'))
		expect(onSelect).toHaveBeenCalledWith('#333333')
	})
})
