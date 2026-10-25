import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountProvider } from '@/features/account'
import { fakeClient, sessionFor } from '@/test/fakeAccountClient'
import { TestZenStateProvider } from '@/test/TestZenStateProvider'
import { PlayerProgressContext } from '@/ui/content/PlayerProgressContext'
import type { GuestImport } from '@/ui/content'
import SettingsDialog from './SettingsDialog'

function renderSettings(
	fake: ReturnType<typeof fakeClient>,
	props: Partial<Parameters<typeof SettingsDialog>[0]> = {},
	guestImport: GuestImport | null = null,
) {
	const onClose = vi.fn()
	render(
		<TestZenStateProvider>
			<PlayerProgressContext.Provider
				value={{
					solved: new Set(),
					markSolved: () => Promise.reject(new Error('unused')),
					guestImport,
				}}
			>
				<AccountProvider client={fake.client}>
					<SettingsDialog
						open
						onClose={onClose}
						onSignIn={vi.fn()}
						onImportProgress={vi.fn()}
						{...props}
					/>
				</AccountProvider>
			</PlayerProgressContext.Provider>
		</TestZenStateProvider>,
	)
	return onClose
}

const signedIn = () => fakeClient(sessionFor('ada@example.com', 'Ada'))

describe('SettingsDialog', () => {
	it('offers a guest sign-in and the game settings, but no account details', async () => {
		const user = userEvent.setup()
		const onSignIn = vi.fn()
		renderSettings(fakeClient(), { onSignIn })
		await user.click(
			await screen.findByRole('button', {
				name: 'Sign in or create an account',
			}),
		)
		expect(onSignIn).toHaveBeenCalledOnce()
		expect(
			screen.getByRole('button', { name: 'Switch to light mode' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Change email' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Sign out' }),
		).not.toBeInTheDocument()
	})

	it('hides the sign-in offer where accounts are unavailable, and the game settings on request', async () => {
		renderSettings(fakeClient(), {
			onSignIn: undefined,
			showGameSettings: false,
		})
		expect(
			await screen.findByRole('dialog', { name: 'Settings' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', {
				name: 'Sign in or create an account',
			}),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: /Switch to/ }),
		).not.toBeInTheDocument()
	})

	it('switches between light and dark mode', async () => {
		const user = userEvent.setup()
		renderSettings(fakeClient())
		await user.click(
			await screen.findByRole('button', { name: 'Switch to light mode' }),
		)
		expect(
			screen.getByRole('button', { name: 'Switch to dark mode' }),
		).toBeInTheDocument()
	})

	it('greets a signed-in player, shows the email, and signs out', async () => {
		const user = userEvent.setup()
		const fake = signedIn()
		fake.auth.signOut.mockResolvedValue({ error: null })
		const onClose = renderSettings(fake)
		expect(await screen.findByText('Hi, Ada!')).toBeInTheDocument()
		expect(screen.getByText('ada@example.com')).toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Sign out' }))
		await waitFor(() =>
			expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' }),
		)
		await waitFor(() => expect(onClose).toHaveBeenCalled())
	})

	it('keeps the account details on screen while closing after sign-out', async () => {
		const user = userEvent.setup()
		const fake = signedIn()
		fake.auth.signOut.mockResolvedValue({ error: null })
		renderSettings(fake)
		await user.click(
			await screen.findByRole('button', { name: 'Sign out' }),
		)
		await waitFor(() => expect(fake.auth.signOut).toHaveBeenCalled())
		act(() => fake.emit(null, 'SIGNED_OUT'))
		expect(screen.getByText('Hi, Ada!')).toBeInTheDocument()
		expect(
			screen.queryByRole('button', {
				name: 'Sign in or create an account',
			}),
		).not.toBeInTheDocument()
	})

	describe('change email', () => {
		async function openEmailForm() {
			const user = userEvent.setup()
			const fake = signedIn()
			renderSettings(fake)
			await user.click(
				await screen.findByRole('button', { name: 'Change email' }),
			)
			return { user, fake }
		}

		it('refuses the address it already has', async () => {
			const { user, fake } = await openEmailForm()
			await user.type(
				screen.getByLabelText('New email'),
				'ADA@example.com',
			)
			await user.type(
				screen.getByLabelText('Current password'),
				'old-pass',
			)
			await user.click(screen.getByRole('button', { name: 'Save' }))
			expect(await screen.findByRole('alert')).toHaveTextContent(
				'already your email address',
			)
			expect(fake.auth.signInWithPassword).not.toHaveBeenCalled()
		})

		it('verifies the password, asks for confirmation, and shows the pending address', async () => {
			const { user, fake } = await openEmailForm()
			fake.auth.signInWithPassword.mockResolvedValue({ error: null })
			fake.auth.updateUser.mockImplementation(() => {
				fake.emit(
					sessionFor('ada@example.com', 'Ada', 'new@example.com'),
					'USER_UPDATED',
				)
				return Promise.resolve({ error: null })
			})
			await user.type(
				screen.getByLabelText('New email'),
				' new@example.com ',
			)
			await user.type(
				screen.getByLabelText('Current password'),
				'old-pass',
			)
			await user.click(screen.getByRole('button', { name: 'Save' }))
			expect(await screen.findByRole('status')).toHaveTextContent(
				'Confirmation sent to new@example.com',
			)
			expect(screen.queryByLabelText('New email')).not.toBeInTheDocument()
			expect(fake.auth.updateUser).toHaveBeenCalledWith(
				{ email: 'new@example.com' },
				expect.anything(),
			)
		})

		it('keeps the form open with the reason when the password is wrong', async () => {
			const { user, fake } = await openEmailForm()
			fake.auth.signInWithPassword.mockResolvedValue({
				error: { code: 'invalid_credentials', message: 'Invalid' },
			})
			await user.type(
				screen.getByLabelText('New email'),
				'new@example.com',
			)
			await user.type(screen.getByLabelText('Current password'), 'nope')
			await user.click(screen.getByRole('button', { name: 'Save' }))
			expect(await screen.findByRole('alert')).toHaveTextContent(
				"That password isn't correct.",
			)
			expect(fake.auth.updateUser).not.toHaveBeenCalled()
			expect(screen.getByLabelText('New email')).toHaveValue(
				'new@example.com',
			)
		})

		it('swaps both change buttons for the form, and brings them back on cancel', async () => {
			const { user, fake } = await openEmailForm()
			expect(
				screen.queryByRole('button', { name: 'Change email' }),
			).not.toBeInTheDocument()
			expect(
				screen.queryByRole('button', { name: 'Change password' }),
			).not.toBeInTheDocument()
			await user.click(screen.getByRole('button', { name: 'Cancel' }))
			expect(screen.queryByLabelText('New email')).not.toBeInTheDocument()
			expect(fake.auth.updateUser).not.toHaveBeenCalled()
			const back = screen.getByRole('button', { name: 'Change email' })
			expect(back).toHaveFocus()
			expect(
				screen.getByRole('button', { name: 'Change password' }),
			).toBeInTheDocument()
		})
	})

	describe('change password', () => {
		async function openPasswordForm() {
			const user = userEvent.setup()
			const fake = signedIn()
			renderSettings(fake)
			await user.click(
				await screen.findByRole('button', { name: 'Change password' }),
			)
			return { user, fake }
		}

		it('needs the new password twice', async () => {
			const { user, fake } = await openPasswordForm()
			await user.type(
				screen.getByLabelText('Current password'),
				'old-pass',
			)
			await user.type(
				screen.getByLabelText('New password'),
				'brand-new-1',
			)
			await user.type(
				screen.getByLabelText('Confirm new password'),
				'brand-new-2',
			)
			await user.click(screen.getByRole('button', { name: 'Save' }))
			expect(await screen.findByRole('alert')).toHaveTextContent(
				"don't match",
			)
			expect(fake.auth.signInWithPassword).not.toHaveBeenCalled()
		})

		it('verifies the current password, saves, and confirms', async () => {
			const { user, fake } = await openPasswordForm()
			fake.auth.signInWithPassword.mockResolvedValue({ error: null })
			fake.auth.updateUser.mockResolvedValue({ error: null })
			await user.type(
				screen.getByLabelText('Current password'),
				'old-pass',
			)
			await user.type(
				screen.getByLabelText('New password'),
				'brand-new-1',
			)
			await user.type(
				screen.getByLabelText('Confirm new password'),
				'brand-new-1',
			)
			await user.click(screen.getByRole('button', { name: 'Save' }))
			expect(await screen.findByRole('status')).toHaveTextContent(
				'Your password has been updated.',
			)
			expect(fake.auth.updateUser).toHaveBeenCalledWith({
				password: 'brand-new-1',
			})
			expect(
				screen.queryByLabelText('Confirm new password'),
			).not.toBeInTheDocument()
		})
	})

	describe('import progress', () => {
		const offer: GuestImport = {
			count: 3,
			offered: false,
			run: vi.fn(() => Promise.resolve(true)),
			decline: vi.fn(),
		}

		it('is offered only while there is something to import', async () => {
			const user = userEvent.setup()
			const onImportProgress = vi.fn()
			renderSettings(signedIn(), { onImportProgress }, offer)
			await user.click(
				await screen.findByRole('button', {
					name: 'Import progress from this device',
				}),
			)
			expect(onImportProgress).toHaveBeenCalledOnce()
		})

		it('is left out with nothing to import', async () => {
			renderSettings(signedIn(), {}, null)
			await screen.findByText('Hi, Ada!')
			expect(
				screen.queryByRole('heading', { name: 'Import progress' }),
			).not.toBeInTheDocument()
		})
	})
})
