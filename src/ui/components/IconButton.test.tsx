import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
	faEraser,
	faRotateLeft,
	faRotateRight,
} from '@fortawesome/sharp-duotone-solid-svg-icons'
import { createRef } from 'react'
import IconButton from './IconButton'

describe('IconButton', () => {
	it('renders an accessible icon-only button that fires onClick', async () => {
		const user = userEvent.setup()
		const onClick = vi.fn()
		render(
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
		render(
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

	it('shows a dot only when asked to', () => {
		const { container, rerender } = render(
			<IconButton icon={faEraser} label="Reset" />,
		)
		expect(container.querySelector('[class*="badge"]')).toBeNull()
		rerender(<IconButton icon={faEraser} label="Reset" badge />)
		expect(container.querySelector('[class*="badge"]')).not.toBeNull()
	})

	it('can be disabled', () => {
		render(
			<IconButton
				icon={faRotateRight}
				label="Redo"
				disabled
				onClick={() => {}}
			/>,
		)
		expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
	})

	it('forwards native attributes, custom styles and a ref without player state', () => {
		const ref = createRef<HTMLButtonElement>()
		render(
			<IconButton
				ref={ref}
				icon={faEraser}
				label="Edit"
				size="sm"
				className="custom"
				aria-pressed
				style={{ color: 'red' }}
			/>,
		)
		const button = screen.getByRole('button', { name: 'Edit' })
		expect(ref.current).toBe(button)
		expect(button).toHaveClass('custom')
		expect(button).toHaveAttribute('aria-pressed', 'true')
		expect(button).toHaveStyle('--icon-button-size: 1.875rem')
		expect(button.querySelector('svg')).not.toHaveAttribute('style')
	})
})
