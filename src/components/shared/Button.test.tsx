import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button'

describe('Button', () => {
	it('renders its label and fires onClick', async () => {
		const user = userEvent.setup()
		const onClick = vi.fn()
		render(<Button onClick={onClick}>Confirm</Button>)

		await user.click(screen.getByRole('button', { name: 'Confirm' }))
		expect(onClick).toHaveBeenCalledOnce()
	})

	it('can be disabled', () => {
		render(
			<Button disabled onClick={() => {}}>
				Download
			</Button>,
		)
		expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
	})
})
