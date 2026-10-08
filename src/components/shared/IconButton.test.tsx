import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IconButton from './IconButton'

describe('IconButton', () => {
	it('renders an accessible icon-only button that fires onClick', async () => {
		const user = userEvent.setup()
		const onClick = vi.fn()
		render(
			<IconButton icon="eraser" label="Reset design" onClick={onClick} />,
		)

		const button = screen.getByRole('button', { name: 'Reset design' })
		expect(button).toHaveAttribute('title', 'Reset design')

		await user.click(button)
		expect(onClick).toHaveBeenCalledOnce()
	})

	it('uses a separate title when given, without changing the accessible name', () => {
		render(
			<IconButton
				icon="rotate-left"
				label="Undo"
				title="Undo (Ctrl/Cmd+Z)"
				onClick={() => {}}
			/>,
		)

		const button = screen.getByRole('button', { name: 'Undo' })
		expect(button).toHaveAttribute('title', 'Undo (Ctrl/Cmd+Z)')
	})

	it('can be disabled', () => {
		render(
			<IconButton
				icon="rotate-right"
				label="Redo"
				disabled
				onClick={() => {}}
			/>,
		)
		expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
	})
})
