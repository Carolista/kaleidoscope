import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { TestZenStateProvider } from '@/test/TestZenStateProvider'
import { AccountProvider } from './AccountProvider'
import AccountControl from './AccountControl'
import AccountDialog from './AccountDialog'
import { useAccount } from './AccountContext'

type AuthListener = (event: string, session: Session | null) => void

function sessionFor(email: string, firstName?: string) {
	return {
		user: {
			email,
			user_metadata: firstName ? { first_name: firstName } : {},
		},
	} as unknown as Session
}

function fakeClient(initial: Session | null = null) {
	let listener: AuthListener = () => undefined
	const auth = {
		onAuthStateChange: vi.fn((callback: AuthListener) => {
			listener = callback
			return { data: { subscription: { unsubscribe: vi.fn() } } }
		}),
		getSession: vi.fn(() =>
			Promise.resolve({ data: { session: initial }, error: null }),
		),
		signUp: vi.fn(),
		signInWithPassword: vi.fn(),
		signOut: vi.fn(),
		resetPasswordForEmail: vi.fn(),
		updateUser: vi.fn(),
	}
	return {
		auth,
		emit: (session: Session | null, event = 'SIGNED_IN') =>
			listener(event, session),
		client: { auth } as unknown as SupabaseClient<Database>,
	}
}

// Mirrors how the player app opens the dialog for reset and expired links.
function ControlAndDialog() {
	const [open, setOpen] = useState(false)
	const account = useAccount()
	if ((account.recovering || account.linkError) && !open) setOpen(true)
	return (
		<>
			<AccountControl onOpen={() => setOpen(true)} />
			<AccountDialog open={open} onClose={() => setOpen(false)} />
		</>
	)
}

function renderControl(fake: ReturnType<typeof fakeClient>) {
	return render(
		<TestZenStateProvider>
			<AccountProvider client={fake.client}>
				<ControlAndDialog />
			</AccountProvider>
		</TestZenStateProvider>,
	)
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
	await user.click(
		await screen.findByRole('button', {
			name: /sign in or create an account|account for/i,
		}),
	)
}

describe('accounts', () => {
	it('stays out of the way when accounts are unavailable', () => {
		vi.stubEnv('VITE_SUPABASE_URL', '')
		render(
			<TestZenStateProvider>
				<AccountProvider>
					<ControlAndDialog />
				</AccountProvider>
			</TestZenStateProvider>,
		)
		expect(screen.queryByRole('button')).not.toBeInTheDocument()
		vi.unstubAllEnvs()
	})

	it('exposes the restored session and first name', async () => {
		const fake = fakeClient(sessionFor('ada@example.com', 'Ada'))
		function Status() {
			const { status, firstName, email } = useAccount()
			return <p>{`${status} ${firstName} ${email}`}</p>
		}
		render(
			<AccountProvider client={fake.client}>
				<Status />
			</AccountProvider>,
		)
		expect(
			await screen.findByText('signedIn Ada ada@example.com'),
		).toBeInTheDocument()
	})

	describe('returning guests', () => {
		function Returning() {
			const { status, returningGuest } = useAccount()
			return <p>{`${status} ${returningGuest}`}</p>
		}
		function renderReturning(fake: ReturnType<typeof fakeClient>) {
			render(
				<TestZenStateProvider>
					<AccountProvider client={fake.client}>
						<Returning />
						<ControlAndDialog />
					</AccountProvider>
				</TestZenStateProvider>,
			)
		}
		beforeEach(() => {
			localStorage.clear()
			sessionStorage.clear()
		})

		it('is not one before the device has had an account', async () => {
			renderReturning(fakeClient())
			expect(
				await screen.findByText('signedOut false'),
			).toBeInTheDocument()
		})

		it('remembers a past sign-in, and is one while signed out', async () => {
			const first = fakeClient(sessionFor('ada@example.com'))
			const { unmount } = render(
				<AccountProvider client={first.client}>
					<Returning />
				</AccountProvider>,
			)
			expect(
				await screen.findByText('signedIn false'),
			).toBeInTheDocument()
			unmount()
			renderReturning(fakeClient())
			expect(
				await screen.findByText('signedOut true'),
			).toBeInTheDocument()
		})

		it('is not one after signing out on purpose in this browser session', async () => {
			const user = userEvent.setup()
			const fake = fakeClient(sessionFor('ada@example.com'))
			fake.auth.signOut.mockResolvedValue({ error: null })
			renderReturning(fake)
			await openDialog(user)
			await user.click(
				await screen.findByRole('button', { name: 'Sign out' }),
			)
			await waitFor(() => expect(fake.auth.signOut).toHaveBeenCalled())
			act(() => fake.emit(null, 'SIGNED_OUT'))
			expect(
				await screen.findByText('signedOut false'),
			).toBeInTheDocument()
		})
	})

	it('signs in with the trimmed email', async () => {
		const user = userEvent.setup()
		const fake = fakeClient()
		fake.auth.signInWithPassword.mockResolvedValue({ error: null })
		renderControl(fake)
		await openDialog(user)
		await user.type(screen.getByLabelText('Email'), ' ada@example.com ')
		await user.type(screen.getByLabelText('Password'), 'secret-pass')
		await user.click(screen.getByRole('button', { name: 'Sign in' }))
		await waitFor(() =>
			expect(fake.auth.signInWithPassword).toHaveBeenCalledWith({
				email: 'ada@example.com',
				password: 'secret-pass',
			}),
		)
	})

	it('shows a sign-in error and stays open', async () => {
		const user = userEvent.setup()
		const fake = fakeClient()
		fake.auth.signInWithPassword.mockResolvedValue({
			error: { message: 'Invalid login credentials' },
		})
		renderControl(fake)
		await openDialog(user)
		await user.type(screen.getByLabelText('Email'), 'ada@example.com')
		await user.type(screen.getByLabelText('Password'), 'wrong-pass')
		await user.click(screen.getByRole('button', { name: 'Sign in' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Invalid login credentials',
		)
	})

	it('creates an account with the first name and asks to confirm the email', async () => {
		const user = userEvent.setup()
		const fake = fakeClient()
		fake.auth.signUp.mockResolvedValue({
			data: { session: null, user: { identities: [{}] } },
			error: null,
		})
		renderControl(fake)
		await openDialog(user)
		await user.click(
			screen.getByRole('button', { name: 'Create an account' }),
		)
		await user.type(screen.getByLabelText('First name'), 'Ada')
		await user.type(screen.getByLabelText('Email'), 'ada@example.com')
		await user.type(screen.getByLabelText('Password'), 'long-enough-1')
		await user.click(screen.getByRole('button', { name: 'Create account' }))
		expect(await screen.findByText(/confirmation link/)).toBeInTheDocument()
		expect(fake.auth.signUp).toHaveBeenCalledWith(
			expect.objectContaining({
				email: 'ada@example.com',
				password: 'long-enough-1',
				options: expect.objectContaining({
					data: { first_name: 'Ada' },
				}),
			}),
		)
	})

	it('warns when the email already has an account', async () => {
		const user = userEvent.setup()
		const fake = fakeClient()
		fake.auth.signUp.mockResolvedValue({
			data: { session: null, user: { identities: [] } },
			error: null,
		})
		renderControl(fake)
		await openDialog(user)
		await user.click(
			screen.getByRole('button', { name: 'Create an account' }),
		)
		await user.type(screen.getByLabelText('First name'), 'Ada')
		await user.type(screen.getByLabelText('Email'), 'ada@example.com')
		await user.type(screen.getByLabelText('Password'), 'long-enough-1')
		await user.click(screen.getByRole('button', { name: 'Create account' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'may already exist',
		)
	})

	it('keeps the form on screen while closing after sign-in, and greets on reopening', async () => {
		const user = userEvent.setup()
		const fake = fakeClient()
		fake.auth.signInWithPassword.mockImplementation(() => {
			fake.emit(sessionFor('ada@example.com', 'Ada'))
			return Promise.resolve({ error: null })
		})
		renderControl(fake)
		await openDialog(user)
		await user.type(screen.getByLabelText('Email'), 'ada@example.com')
		await user.type(screen.getByLabelText('Password'), 'secret-pass')
		await user.click(screen.getByRole('button', { name: 'Sign in' }))
		await waitFor(() =>
			expect(fake.auth.signInWithPassword).toHaveBeenCalled(),
		)
		expect(screen.queryByText('Hi, Ada!')).not.toBeInTheDocument()
		await openDialog(user)
		expect(await screen.findByText('Hi, Ada!')).toBeInTheDocument()
	})

	it('shows a readable message when the server times out', async () => {
		const user = userEvent.setup()
		const fake = fakeClient()
		fake.auth.signUp.mockResolvedValue({
			data: { session: null, user: null },
			error: { message: '{}', status: 504 },
		})
		renderControl(fake)
		await openDialog(user)
		await user.click(
			screen.getByRole('button', { name: 'Create an account' }),
		)
		await user.type(screen.getByLabelText('First name'), 'Ada')
		await user.type(screen.getByLabelText('Email'), 'ada@example.com')
		await user.type(screen.getByLabelText('Password'), 'long-enough-1')
		await user.click(screen.getByRole('button', { name: 'Create account' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			"We couldn't create your account right now",
		)
	})

	it('ignores a result that arrives after the dialog was closed', async () => {
		const user = userEvent.setup()
		const fake = fakeClient()
		let finish: (value: unknown) => void = () => undefined
		fake.auth.signInWithPassword.mockReturnValue(
			new Promise(resolve => {
				finish = resolve
			}),
		)
		renderControl(fake)
		await openDialog(user)
		await user.type(screen.getByLabelText('Email'), 'ada@example.com')
		await user.type(screen.getByLabelText('Password'), 'secret-pass')
		await user.click(screen.getByRole('button', { name: 'Sign in' }))
		await user.click(
			screen.getByRole('button', { name: 'Close account dialog' }),
		)
		await act(async () => {
			finish({ error: { message: '{}', status: 504 } })
		})
		await openDialog(user)
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
	})

	it('sends a password reset link', async () => {
		const user = userEvent.setup()
		const fake = fakeClient()
		fake.auth.resetPasswordForEmail.mockResolvedValue({
			data: {},
			error: null,
		})
		renderControl(fake)
		await openDialog(user)
		await user.click(
			screen.getByRole('button', { name: 'Forgot your password?' }),
		)
		await user.type(screen.getByLabelText('Email'), 'ada@example.com')
		await user.click(
			screen.getByRole('button', { name: 'Send reset link' }),
		)
		expect(await screen.findByText(/has an account/)).toBeInTheDocument()
		expect(fake.auth.resetPasswordForEmail).toHaveBeenCalledWith(
			'ada@example.com',
			expect.objectContaining({ redirectTo: expect.any(String) }),
		)
	})

	it('opens a new-password form after a reset link and saves it', async () => {
		const user = userEvent.setup()
		const fake = fakeClient()
		fake.auth.updateUser.mockResolvedValue({ data: {}, error: null })
		renderControl(fake)
		await screen.findByRole('button', { name: /sign in or create/i })
		act(() =>
			fake.emit(
				sessionFor('ada@example.com', 'Ada'),
				'PASSWORD_RECOVERY',
			),
		)
		expect(
			await screen.findByRole('heading', {
				name: 'Choose a new password',
			}),
		).toBeInTheDocument()
		await user.type(screen.getByLabelText('New password'), 'brand-new-pass')
		await user.type(
			screen.getByLabelText('Confirm new password'),
			'different-pass',
		)
		await user.click(
			screen.getByRole('button', { name: 'Save new password' }),
		)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			"don't match",
		)
		expect(fake.auth.updateUser).not.toHaveBeenCalled()
		await user.clear(screen.getByLabelText('Confirm new password'))
		await user.type(
			screen.getByLabelText('Confirm new password'),
			'brand-new-pass',
		)
		await user.click(
			screen.getByRole('button', { name: 'Save new password' }),
		)
		expect(
			await screen.findByText(/Your password has been updated/),
		).toBeInTheDocument()
		expect(fake.auth.updateUser).toHaveBeenCalledWith({
			password: 'brand-new-pass',
		})
		await user.click(screen.getByRole('button', { name: 'Done' }))
		await user.click(
			await screen.findByRole('button', { name: /account for ada/i }),
		)
		expect(await screen.findByText('Hi, Ada!')).toBeInTheDocument()
	})

	it('says so when an email link has expired', async () => {
		window.location.hash =
			'#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
		const fake = fakeClient()
		renderControl(fake)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'That link has expired or was already used.',
		)
		expect(window.location.hash).toBe(
			'#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
		)
		await userEvent.click(
			screen.getByRole('button', { name: 'Close account dialog' }),
		)
		expect(window.location.hash).toBe('')
	})

	it('greets a signed-in player and signs out', async () => {
		const user = userEvent.setup()
		const fake = fakeClient(sessionFor('ada@example.com', 'Ada'))
		fake.auth.signOut.mockResolvedValue({ error: null })
		renderControl(fake)
		await openDialog(user)
		expect(await screen.findByText('Hi, Ada!')).toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Sign out' }))
		await waitFor(() =>
			expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' }),
		)
	})
})
