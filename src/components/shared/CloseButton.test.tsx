import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CloseButton from './CloseButton'

describe('CloseButton', () => {
	it('renders with its label as the accessible name and fires onClick', async () => {
		const user = userEvent.setup()
		const onClick = vi.fn()
		render(
			<CloseButton
				label="Close color palette selector"
				onClick={onClick}
			/>,
		)

		await user.click(
			screen.getByRole('button', {
				name: 'Close color palette selector',
			}),
		)
		expect(onClick).toHaveBeenCalledOnce()
	})
})
