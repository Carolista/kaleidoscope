import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
	faEraser,
	faRotateLeft,
	faRotateRight,
} from '@fortawesome/sharp-duotone-solid-svg-icons'
import { renderWithProvider } from '@test/renderWithProvider'
import IconButton from './IconButton'

describe('IconButton', () => {
	it('renders an accessible icon-only button that fires onClick', async () => {
		const user = userEvent.setup()
		const onClick = vi.fn()
		renderWithProvider(
			<IconButton
				icon={faEraser}
				label="Reset design"
				onClick={onClick}
			/>,
		)

		const button = screen.getByRole('button', { name: 'Reset design' })
		expect(button).toHaveAttribute('title', 'Reset design')

		await user.click(button)
		expect(onClick).toHaveBeenCalledOnce()
	})

	it('uses a separate title when given, without changing the accessible name', () => {
		renderWithProvider(
			<IconButton
				icon={faRotateLeft}
				label="Undo"
				title="Undo (Ctrl/Cmd+Z)"
				onClick={() => {}}
			/>,
		)

		const button = screen.getByRole('button', { name: 'Undo' })
		expect(button).toHaveAttribute('title', 'Undo (Ctrl/Cmd+Z)')
	})

	it('can be disabled', () => {
		renderWithProvider(
			<IconButton
				icon={faRotateRight}
				label="Redo"
				disabled
				onClick={() => {}}
			/>,
		)
		expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
	})
})
