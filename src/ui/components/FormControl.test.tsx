import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input, Select } from './FormControl'
import Button from './Button'

describe('shared form controls', () => {
	it('forwards native field, validation, accessibility and ref props', async () => {
		const input = createRef<HTMLInputElement>()
		const select = createRef<HTMLSelectElement>()
		const submit = vi.fn(event => event.preventDefault())
		const user = userEvent.setup()
		render(
			<form onSubmit={submit}>
				<label htmlFor="email">Email</label>
				<Input
					id="email"
					name="email"
					type="email"
					required
					ref={input}
					className="custom"
					aria-describedby="help"
				/>
				<p id="help">Use your admin email.</p>
				<label htmlFor="role">Role</label>
				<Select id="role" name="role" ref={select} defaultValue="core">
					<option value="core">Core</option>
					<option value="reward">Reward</option>
				</Select>
				<Button type="submit">Save</Button>
			</form>,
		)
		expect(input.current).toBe(screen.getByLabelText('Email'))
		expect(select.current).toBe(screen.getByLabelText('Role'))
		expect(input.current).toHaveClass('custom')
		expect(input.current).toHaveAccessibleDescription(
			'Use your admin email.',
		)
		await user.click(screen.getByRole('button', { name: 'Save' }))
		expect(submit).not.toHaveBeenCalled()
		await user.type(screen.getByLabelText('Email'), 'admin@example.com')
		await user.selectOptions(screen.getByLabelText('Role'), 'reward')
		await user.click(screen.getByRole('button', { name: 'Save' }))
		expect(submit).toHaveBeenCalledOnce()
		expect(new FormData(input.current!.form!).get('role')).toBe('reward')
	})

	it('retains native disabled, read-only and invalid states', () => {
		render(
			<>
				<Input aria-label="Name" readOnly value="Saved" aria-invalid />
				<Select aria-label="Role" disabled>
					<option>Core</option>
				</Select>
			</>,
		)
		expect(screen.getByLabelText('Name')).toHaveAttribute('readonly')
		expect(screen.getByLabelText('Name')).toBeInvalid()
		expect(screen.getByLabelText('Role')).toBeDisabled()
	})
})
