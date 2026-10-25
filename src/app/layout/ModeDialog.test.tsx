import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModeDialog from './ModeDialog'
import type { Mode } from './modes'

function renderDialog(mode: Mode = 'home') {
	const onSelect = vi.fn()
	function Host() {
		const [open, setOpen] = useState(true)
		return (
			<ModeDialog
				open={open}
				mode={mode}
				onSelect={onSelect}
				onClose={() => setOpen(false)}
			/>
		)
	}
	render(<Host />)
	return onSelect
}

describe('ModeDialog', () => {
	it('offers every mode and marks the current one', () => {
		renderDialog('zen')
		expect(
			screen.getByRole('dialog', { name: 'Choose a mode' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Home' }),
		).not.toHaveAttribute('aria-current')
		expect(
			screen.getByRole('button', { name: 'Zen Mode' }),
		).toHaveAttribute('aria-current', 'true')
		expect(
			screen.getByRole('button', { name: 'Puzzle Mode' }),
		).not.toHaveAttribute('aria-current')
	})

	it('selects another mode and closes', async () => {
		const onSelect = renderDialog('home')
		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: 'Puzzle Mode' }))
		expect(onSelect).toHaveBeenCalledWith('puzzle')
	})

	it('only closes when the current mode is chosen', async () => {
		const onSelect = renderDialog('zen')
		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: 'Zen Mode' }))
		expect(onSelect).not.toHaveBeenCalled()
	})
})
