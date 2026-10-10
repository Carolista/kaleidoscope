import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { isConfirmDialogDismissed } from '@services/confirmDialogPreferences'
import { renderWithProvider } from '@test/renderWithProvider'
import ConfirmDialog from './ConfirmDialog'

describe('ConfirmDialog', () => {
	beforeEach(() => localStorage.clear())

	function renderControlledDialog(preferenceKey?: string) {
		const onConfirm = vi.fn()
		const onCancel = vi.fn()
		function Harness() {
			const [open, setOpen] = useState(true)
			return (
				<>
					<button onClick={() => setOpen(true)}>Reopen</button>
					<ConfirmDialog
						open={open}
						title="Confirm action"
						message="This changes your design."
						dontShowAgainKey={preferenceKey}
						onConfirm={() => {
							onConfirm()
							setOpen(false)
						}}
						onCancel={() => {
							onCancel()
							setOpen(false)
						}}
					/>
				</>
			)
		}
		renderWithProvider(<Harness />)
		return { onConfirm, onCancel }
	}

	it('offers no preference checkbox without a key and confirms once', async () => {
		const { onConfirm, onCancel } = renderControlledDialog()
		expect(
			screen.getByText('This changes your design.'),
		).toBeInTheDocument()
		expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: 'Confirm', exact: true }))
		expect(onConfirm).toHaveBeenCalledTimes(1)
		expect(onCancel).not.toHaveBeenCalled()
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
	})

	it.each(['button', 'native cancel', 'backdrop'] as const)(
		'cancels via %s without saving a checked preference and clears it on reopen',
		async method => {
			const user = userEvent.setup()
			const { onConfirm, onCancel } =
				renderControlledDialog('test-cancel')
			await user.click(screen.getByRole('checkbox'))
			if (method === 'button')
				await user.click(screen.getByRole('button', { name: 'Cancel' }))
			else if (method === 'backdrop')
				await user.click(screen.getByRole('dialog'))
			else
				fireEvent(
					screen.getByRole('dialog'),
					new Event('cancel', { cancelable: true }),
				)
			expect(onCancel).toHaveBeenCalledTimes(1)
			expect(onConfirm).not.toHaveBeenCalled()
			expect(isConfirmDialogDismissed('test-cancel')).toBe(false)
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
			await user.click(screen.getByRole('button', { name: 'Reopen' }))
			expect(screen.getByRole('checkbox')).not.toBeChecked()
		},
	)

	it.each([false, true])(
		'persists only the checked preference on confirmation: %s',
		async checked => {
			const user = userEvent.setup()
			const { onConfirm } = renderControlledDialog('test-confirm')
			if (checked) await user.click(screen.getByRole('checkbox'))
			await user.click(
				screen.getByRole('button', { name: 'Confirm', exact: true }),
			)
			expect(onConfirm).toHaveBeenCalledTimes(1)
			expect(isConfirmDialogDismissed('test-confirm')).toBe(checked)
			expect(isConfirmDialogDismissed('unrelated-action')).toBe(false)
			await user.click(screen.getByRole('button', { name: 'Reopen' }))
			expect(screen.getByRole('checkbox')).not.toBeChecked()
		},
	)

	it('gives each mounted dialog a unique reference to its own heading', () => {
		renderWithProvider(
			<>
				<ConfirmDialog
					open={false}
					title="Confirm Reset"
					message="Reset the design?"
					onConfirm={() => {}}
					onCancel={() => {}}
				/>
				<ConfirmDialog
					open
					title="Confirm Shape Change"
					message="Switch the grid shape?"
					onConfirm={() => {}}
					onCancel={() => {}}
				/>
			</>,
		)

		const dialogs = screen.getAllByRole('dialog', { hidden: true })
		const titleIds = dialogs.map(dialog =>
			dialog.getAttribute('aria-labelledby'),
		)

		expect(dialogs).toHaveLength(2)
		expect(new Set(titleIds).size).toBe(2)

		for (const [index, dialog] of dialogs.entries()) {
			const titleId = titleIds[index]
			if (!titleId) throw new Error('Dialog has no heading reference')
			const heading = document.getElementById(titleId)
			expect(dialog).toContainElement(heading)
			expect(heading).toHaveTextContent(
				index === 0 ? 'Confirm Reset' : 'Confirm Shape Change',
			)
		}

		expect(
			screen.getByRole('dialog', { name: 'Confirm Shape Change' }),
		).toBe(dialogs[1])
	})
})
