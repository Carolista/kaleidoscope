import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SetCreationDialog from './SetCreationDialog'

describe('set creation dialog', () => {
	it('ignores form submission while closing', () => {
		const onCreate = vi.fn().mockResolvedValue(undefined)
		const dialog = (open: boolean) => (
			<SetCreationDialog
				open={open}
				onAfterClose={vi.fn()}
				title="New set"
				formLabel="Create draft set"
				kindLabel="Set role"
				kinds={{ core: 'Core' }}
				initialKind="core"
				confirmLabel="Create set"
				pendingLabel="Creating set…"
				onCreate={onCreate}
				onCancel={vi.fn()}
			/>
		)
		const { rerender } = render(dialog(true))
		fireEvent.change(screen.getByLabelText('Set name'), {
			target: { value: 'Already saved' },
		})
		rerender(dialog(false))
		fireEvent.submit(screen.getByLabelText('Create draft set'))
		expect(onCreate).not.toHaveBeenCalled()
		expect(screen.getByLabelText('Set name')).toBeDisabled()
	})

	it('validates names, submits on Enter, blocks duplicate writes and all dismissal while pending, and retains retry IDs', async () => {
		let fail!: (cause: Error) => void
		const onCreate = vi
			.fn<
				(
					id: string,
					name: string,
					kind: 'core' | 'paid',
				) => Promise<void>
			>()
			.mockImplementationOnce(
				() =>
					new Promise((_resolve, reject) => {
						fail = reject
					}),
			)
			.mockRejectedValue(new Error('Try again'))
		const onCancel = vi.fn()
		render(
			<SetCreationDialog
				open
				onAfterClose={vi.fn()}
				title="New set"
				formLabel="Create draft set"
				kindLabel="Set role"
				kinds={{ core: 'Core', paid: 'Paid' }}
				initialKind="core"
				confirmLabel="Create set"
				pendingLabel="Creating set…"
				onCreate={onCreate}
				onCancel={onCancel}
			/>,
		)
		const dialog = screen.getByRole('dialog', { name: 'New set' })
		expect(screen.getByLabelText('Set name')).toHaveFocus()
		const user = userEvent.setup()
		expect(
			screen.getByRole('button', { name: 'Create set' }),
		).toBeDisabled()
		await user.type(screen.getByLabelText('Set name'), '   ')
		expect(
			screen.getByRole('button', { name: 'Create set' }),
		).toBeDisabled()
		await user.clear(screen.getByLabelText('Set name'))
		await user.type(screen.getByLabelText('Set name'), 'First{Enter}')
		fireEvent.submit(screen.getByRole('form', { name: 'Create draft set' }))
		expect(onCreate).toHaveBeenCalledOnce()
		const request = onCreate.mock.calls[0]
		expect(request).toEqual([
			expect.any(String),
			'First',
			'core',
			undefined,
		])
		for (const button of within(dialog).getAllByRole('button'))
			expect(button).toBeDisabled()
		fireEvent(dialog, new Event('cancel', { cancelable: true }))
		fireEvent.click(dialog)
		expect(onCancel).not.toHaveBeenCalled()
		await act(async () => {
			fail(new Error('Lost response'))
		})
		expect(within(dialog).getByRole('alert')).toHaveTextContent(
			'Lost response',
		)
		expect(screen.getByLabelText('Set name')).toHaveValue('First')
		await user.click(screen.getByRole('button', { name: 'Create set' }))
		await screen.findByText('Try again')
		expect(onCreate.mock.calls[1]).toEqual(request)
		await user.selectOptions(screen.getByLabelText('Set role'), 'paid')
		await user.click(screen.getByRole('button', { name: 'Create set' }))
		await screen.findByText('Try again')
		expect(onCreate.mock.calls[2][0]).not.toBe(request[0])
		expect(onCreate.mock.calls[2].slice(1)).toEqual([
			'First',
			'paid',
			undefined,
		])
		await user.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(onCancel).toHaveBeenCalledOnce()
	})

	it('offers an optional shape choice that is submitted and gets its own retry ID', async () => {
		const user = userEvent.setup()
		const onCreate = vi.fn().mockRejectedValue(new Error('Try again'))
		render(
			<SetCreationDialog
				open
				onAfterClose={vi.fn()}
				title="New set"
				formLabel="Create draft set"
				kindLabel="Set role"
				kinds={{ core: 'Core' }}
				initialKind="core"
				confirmLabel="Create set"
				pendingLabel="Creating set…"
				shape={{
					label: 'Shape',
					options: { hexagon: 'Hexagon', triangle: 'Triangle' },
					initial: 'hexagon',
				}}
				onCreate={onCreate}
				onCancel={vi.fn()}
			/>,
		)
		expect(screen.getByLabelText('Shape')).toHaveValue('hexagon')
		await user.type(screen.getByLabelText('Set name'), 'Triangles')
		await user.click(screen.getByRole('button', { name: 'Create set' }))
		await screen.findByText('Try again')
		await user.selectOptions(screen.getByLabelText('Shape'), 'triangle')
		await user.click(screen.getByRole('button', { name: 'Create set' }))
		await screen.findByText('Try again')
		expect(onCreate.mock.calls[0].slice(1)).toEqual([
			'Triangles',
			'core',
			'hexagon',
		])
		expect(onCreate.mock.calls[1].slice(1)).toEqual([
			'Triangles',
			'core',
			'triangle',
		])
		expect(onCreate.mock.calls[1][0]).not.toBe(onCreate.mock.calls[0][0])
	})
})
