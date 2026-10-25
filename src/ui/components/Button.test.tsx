import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import Button from './Button'
import { TextCaseContext } from '@/ui/text'

describe('Button', () => {
	it('forwards native props and refs and defaults to a non-submit button', async () => {
		const submit = vi.fn(event => event.preventDefault())
		const ref = createRef<HTMLButtonElement>()
		render(
			<form id="settings" onSubmit={submit}>
				<Button ref={ref} className="custom" aria-describedby="hint">
					Preview
				</Button>
				<p id="hint">Preview without saving</p>
			</form>,
		)
		const button = screen.getByRole('button', { name: 'Preview' })
		expect(ref.current).toBe(button)
		expect(button).toHaveClass('custom')
		expect(button).toHaveAttribute('type', 'button')
		expect(button).toHaveAccessibleDescription('Preview without saving')
		await userEvent.setup().click(button)
		expect(submit).not.toHaveBeenCalled()
	})

	it('preserves required validation and Enter-to-submit for native forms', async () => {
		const submit = vi.fn(event => event.preventDefault())
		const user = userEvent.setup()
		render(
			<form onSubmit={submit}>
				<label htmlFor="name">Name</label>
				<input id="name" required />
				<Button type="submit">Save</Button>
			</form>,
		)
		await user.click(screen.getByRole('button', { name: 'Save' }))
		expect(submit).not.toHaveBeenCalled()
		await user.type(screen.getByRole('textbox'), 'Palette{Enter}')
		expect(submit).toHaveBeenCalledOnce()
	})

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

	describe('text case', () => {
		it('shows labels as written by default', () => {
			render(<Button>sign in or create an account</Button>)
			expect(
				screen.getByRole('button', {
					name: 'sign in or create an account',
				}),
			).toBeInTheDocument()
		})

		it('title-cases text labels where the app opts in, leaving icons alone', () => {
			render(
				<TextCaseContext.Provider value="title">
					<Button>
						<svg data-testid="icon" />
						sign in or create an account
					</Button>
				</TextCaseContext.Provider>,
			)
			expect(
				screen.getByRole('button', {
					name: 'Sign In or Create an Account',
				}),
			).toContainElement(screen.getByTestId('icon'))
		})

		it('reads a label split across strings as one title', () => {
			render(
				<TextCaseContext.Provider value="title">
					<Button>import {3} puzzles to the account</Button>
				</TextCaseContext.Provider>,
			)
			expect(
				screen.getByRole('button', {
					name: 'Import 3 Puzzles to the Account',
				}),
			).toBeInTheDocument()
		})
	})
})
