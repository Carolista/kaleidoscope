import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayerProgressContext } from '@/ui/content/PlayerProgressContext'
import type { GuestImport } from '@/ui/content'
import GuestImportDialog from './GuestImportDialog'

function offer(overrides: Partial<GuestImport> = {}): GuestImport {
	return {
		count: 3,
		offered: true,
		run: vi.fn(() => Promise.resolve(true)),
		decline: vi.fn(),
		...overrides,
	}
}

function renderDialog(
	guestImport: GuestImport | null,
	props: { requested?: boolean; suspended?: boolean } = {},
) {
	const onClose = vi.fn()
	render(
		<PlayerProgressContext.Provider
			value={{
				solved: new Set(),
				markSolved: () => Promise.reject(new Error('unused')),
				guestImport,
			}}
		>
			<GuestImportDialog
				requested={false}
				suspended={false}
				onClose={onClose}
				{...props}
			/>
		</PlayerProgressContext.Provider>,
	)
	return onClose
}

describe('GuestImportDialog', () => {
	it('asks before moving anything, then imports and closes', async () => {
		const user = userEvent.setup()
		const guestImport = offer()
		const onClose = renderDialog(guestImport)
		expect(
			await screen.findByRole('dialog', {
				name: 'Import your progress?',
			}),
		).toHaveTextContent('You solved 3 puzzles as a guest')
		expect(guestImport.run).not.toHaveBeenCalled()
		await user.click(
			screen.getByRole('button', { name: 'Import progress' }),
		)
		expect(guestImport.run).toHaveBeenCalledOnce()
		await waitFor(() => expect(onClose).toHaveBeenCalled())
	})

	it('keeps the guest save when declined', async () => {
		const user = userEvent.setup()
		const guestImport = offer()
		const onClose = renderDialog(guestImport)
		await user.click(await screen.findByRole('button', { name: 'Not now' }))
		expect(guestImport.decline).toHaveBeenCalledOnce()
		expect(guestImport.run).not.toHaveBeenCalled()
		expect(onClose).toHaveBeenCalled()
	})

	it('says so and stays open when the import fails', async () => {
		const user = userEvent.setup()
		const guestImport = offer({ run: vi.fn(() => Promise.resolve(false)) })
		const onClose = renderDialog(guestImport)
		await user.click(
			await screen.findByRole('button', { name: 'Import progress' }),
		)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			/import your progress right now/,
		)
		expect(onClose).not.toHaveBeenCalled()
	})

	it('does not open by itself after a no, while another dialog is open, or with nothing to import', () => {
		renderDialog(offer({ offered: false }))
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
	})

	it('opens on request after a no', async () => {
		renderDialog(offer({ offered: false }), { requested: true })
		expect(await screen.findByRole('dialog')).toBeInTheDocument()
	})

	it('waits while another dialog is open', () => {
		renderDialog(offer(), { suspended: true })
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
	})
})
