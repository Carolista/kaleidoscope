import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FormField from './FormField'
import { Input, Select } from './FormControl'

describe('FormField', () => {
	it('associates labels, help and validation errors with the native control', () => {
		const { rerender } = render(
			<FormField
				id="name"
				label="Name"
				help="Give it a name."
				error="Name is required."
			>
				{field => <Input {...field} />}
			</FormField>,
		)
		const input = screen.getByLabelText('Name')
		expect(input).toHaveAttribute('id', 'name')
		expect(input).toHaveAccessibleDescription(
			'Give it a name. Name is required.',
		)
		expect(input).toBeInvalid()
		expect(screen.getByRole('alert')).toHaveTextContent('Name is required.')
		rerender(
			<FormField id="name" label="Name">
				{field => <Input {...field} />}
			</FormField>,
		)
		expect(input).not.toHaveAttribute('aria-describedby')
		expect(input).not.toHaveAttribute('aria-invalid')
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
	})

	it('generates distinct stable label IDs for multiple controls', () => {
		function Fields() {
			return (
				<>
					<FormField label="First">
						{field => <Input {...field} />}
					</FormField>
					<FormField label="Second">
						{field => (
							<Select {...field}>
								<option>Core</option>
							</Select>
						)}
					</FormField>
				</>
			)
		}
		const { rerender } = render(<Fields />)
		const firstId = screen.getByLabelText('First').id
		const secondId = screen.getByLabelText('Second').id
		expect(firstId).not.toBe(secondId)
		rerender(<Fields />)
		expect(screen.getByLabelText('First').id).toBe(firstId)
		expect(screen.getByLabelText('Second').id).toBe(secondId)
	})

	it('preserves refs, required validation, keyboard submit and native fieldset disabling', async () => {
		const ref = createRef<HTMLInputElement>()
		const submit = vi.fn(event => event.preventDefault())
		const user = userEvent.setup()
		render(
			<form onSubmit={submit}>
				<FormField label="Set name">
					{field => (
						<Input {...field} ref={ref} required name="name" />
					)}
				</FormField>
				<fieldset disabled>
					<FormField label="Role">
						{field => (
							<Select {...field}>
								<option>Core</option>
							</Select>
						)}
					</FormField>
				</fieldset>
				<button type="submit">Save</button>
			</form>,
		)
		expect(ref.current).toBe(screen.getByLabelText('Set name'))
		expect(screen.getByLabelText('Role')).toBeDisabled()
		await user.click(screen.getByText('Save'))
		expect(submit).not.toHaveBeenCalled()
		await user.type(ref.current!, 'New set{Enter}')
		expect(submit).toHaveBeenCalledOnce()
		expect(new FormData(ref.current!.form!).get('name')).toBe('New set')
	})
})
