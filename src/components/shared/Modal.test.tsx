import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from './Modal'

describe('Modal', () => {
	it('synchronizes native open state with its controlled prop and labels its content', () => {
		const onClose = vi.fn()
		const content = <h2 id="modal-title">Test modal</h2>
		const { rerender } = render(
			<Modal open={false} onClose={onClose} labelledBy="modal-title">
				{content}
			</Modal>,
		)
		const dialog = screen.getByRole('dialog', { hidden: true })
		expect(dialog).not.toHaveAttribute('open')
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		rerender(
			<Modal open onClose={onClose} labelledBy="modal-title">
				{content}
			</Modal>,
		)
		expect(screen.getByRole('dialog', { name: 'Test modal' })).toBe(dialog)
		expect(dialog).toHaveAttribute('open')
		expect(dialog).toContainElement(
			screen.getByRole('heading', { name: 'Test modal' }),
		)
		rerender(
			<Modal open={false} onClose={onClose} labelledBy="modal-title">
				{content}
			</Modal>,
		)
		expect(dialog).not.toHaveAttribute('open')
		expect(onClose).not.toHaveBeenCalled()
	})

	it('requests dismissal on native cancel but leaves closing to the parent', () => {
		const onClose = vi.fn()
		render(
			<Modal open onClose={onClose} labelledBy="modal-title">
				<h2 id="modal-title">Test modal</h2>
			</Modal>,
		)
		const dialog = screen.getByRole('dialog')
		// jsdom does not translate Escape into the native dialog cancel event.
		const cancel = new Event('cancel', { cancelable: true })
		fireEvent(dialog, cancel)
		expect(cancel.defaultPrevented).toBe(true)
		expect(onClose).toHaveBeenCalledTimes(1)
		expect(dialog).toHaveAttribute('open')
	})

	it('dismisses only on a direct backdrop click, not a content click', async () => {
		const onClose = vi.fn()
		const user = userEvent.setup()
		render(
			<Modal open onClose={onClose} labelledBy="modal-title">
				<div>
					<h2 id="modal-title">Test modal</h2>
					<button>Content action</button>
				</div>
			</Modal>,
		)
		await user.click(screen.getByRole('heading'))
		await user.click(screen.getByRole('button', { name: 'Content action' }))
		expect(onClose).not.toHaveBeenCalled()
		await user.click(screen.getByRole('dialog'))
		expect(onClose).toHaveBeenCalledTimes(1)
	})
})
