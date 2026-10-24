import { useId, useRef, useState, type SubmitEvent } from 'react'
import { Button, FormField, Input, Modal, ModalHeader } from '@/ui/components'
import { useAccount } from './AccountContext'
import styles from './AccountDialog.module.css'

type View =
	| 'signIn'
	| 'signUp'
	| 'confirm'
	| 'forgot'
	| 'resetSent'
	| 'newPassword'
	| 'passwordUpdated'

const TITLES: Record<View | 'account', string> = {
	signIn: 'Sign in',
	signUp: 'Create an account',
	confirm: 'Check your email',
	forgot: 'Reset your password',
	resetSent: 'Check your email',
	newPassword: 'Choose a new password',
	passwordUpdated: 'Password updated',
	account: 'Your account',
}

const SUBMIT_LABELS: Partial<Record<View, readonly [string, string]>> = {
	signIn: ['Sign in', 'Signing in…'],
	signUp: ['Create account', 'Creating account…'],
	forgot: ['Send reset link', 'Sending…'],
	newPassword: ['Save new password', 'Saving…'],
}

// Following a reset link signs the player in; these views belong to that visit.
const RECOVERY_VIEWS: readonly View[] = ['newPassword', 'passwordUpdated']

// The one place a player signs in, creates an account, resets a password, or signs
// out. Everything else in the app works without it.
export default function AccountDialog({
	open,
	onClose,
}: {
	readonly open: boolean
	readonly onClose: () => void
}) {
	const account = useAccount()
	const titleId = useId()
	const firstFieldRef = useRef<HTMLInputElement>(null)
	// Counts dialog resets, so a request that finishes after the dialog was closed
	// cannot write its result into the next opening.
	const attempt = useRef(0)
	const [view, setView] = useState<View>('signIn')
	const [pending, setPending] = useState(false)
	const [error, setError] = useState('')
	const [sentTo, setSentTo] = useState('')
	// What the dialog shows follows the account only while it is open and idle, so
	// signing in or out never swaps the content while the dialog is fading away.
	const [signedIn, setSignedIn] = useState(account.status === 'signedIn')
	if (open && !pending) {
		if (signedIn !== (account.status === 'signedIn')) {
			setSignedIn(account.status === 'signedIn')
		}
		if (account.recovering && !RECOVERY_VIEWS.includes(view)) {
			setView('newPassword')
		}
	}
	const showAccount = signedIn && !RECOVERY_VIEWS.includes(view)
	const title = showAccount ? TITLES.account : TITLES[view]
	const shownError =
		error || (view === 'signIn' && !showAccount ? account.linkError : '')

	function show(next: View) {
		setView(next)
		setError('')
	}

	function close() {
		account.endRecovery()
		account.dismissLinkError()
		onClose()
	}

	function reset() {
		attempt.current++
		show('signIn')
		setSentTo('')
		setPending(false)
	}

	// Runs a request and applies its result, unless the dialog was closed meanwhile.
	// A success that closes the dialog stays pending until it has finished closing.
	async function run<Result extends { status: string }>(
		request: () => Promise<Result>,
		onResult: (result: Result) => 'stay' | 'closing',
	) {
		const started = attempt.current
		setPending(true)
		setError('')
		const result = await request()
		if (attempt.current !== started) return
		if (onResult(result) === 'stay') setPending(false)
	}

	function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		const values = new FormData(event.currentTarget)
		const email = String(values.get('email') ?? '').trim()
		const password = String(values.get('password') ?? '')

		function failed(result: { status: string; message?: string }) {
			if (result.status !== 'error') return false
			setError(result.message ?? '')
			return true
		}

		if (view === 'signUp') {
			void run(
				() =>
					account.signUp({
						firstName: String(values.get('firstName')).trim(),
						email,
						password,
					}),
				result => {
					if (failed(result)) return 'stay'
					if (result.status === 'confirm') {
						setSentTo(email)
						setView('confirm')
						return 'stay'
					}
					close()
					return 'closing'
				},
			)
		} else if (view === 'forgot') {
			void run(
				() => account.requestPasswordReset(email),
				result => {
					if (!failed(result)) {
						setSentTo(email)
						setView('resetSent')
					}
					return 'stay'
				},
			)
		} else if (view === 'newPassword') {
			if (password !== String(values.get('confirmPassword'))) {
				setError("The passwords don't match.")
				return
			}
			void run(
				() => account.updatePassword(password),
				result => {
					if (!failed(result)) setView('passwordUpdated')
					return 'stay'
				},
			)
		} else {
			void run(
				() => account.signIn({ email, password }),
				result => {
					if (failed(result)) return 'stay'
					close()
					return 'closing'
				},
			)
		}
	}

	function signOut() {
		void run(
			() => account.signOut(),
			result => {
				if (result.status === 'error') {
					setError(result.message)
					return 'stay'
				}
				close()
				return 'closing'
			},
		)
	}

	const submitLabels = SUBMIT_LABELS[view]
	const passwordView = view === 'signIn' || view === 'signUp'
	const passwordField = (
		<FormField
			label={view === 'newPassword' ? 'New password' : 'Password'}
			help={
				view === 'signUp' || view === 'newPassword'
					? 'At least 8 characters.'
					: undefined
			}
		>
			{field => (
				<Input
					{...field}
					ref={view === 'newPassword' ? firstFieldRef : undefined}
					name="password"
					type="password"
					autoComplete={
						view === 'signIn' ? 'current-password' : 'new-password'
					}
					minLength={view === 'signIn' ? undefined : 8}
					required
					disabled={pending}
				/>
			)}
		</FormField>
	)

	return (
		<Modal
			open={open}
			onClose={close}
			onAfterClose={reset}
			labelledBy={titleId}
			className={styles.dialog}
			initialFocusRef={firstFieldRef}
			header={
				<ModalHeader
					title={title}
					titleId={titleId}
					closeLabel="Close account dialog"
					onClose={close}
				/>
			}
		>
			{showAccount ? (
				<div className={styles.content}>
					<p className={styles.greeting}>
						{account.firstName
							? `Hi, ${account.firstName}!`
							: 'Hi there!'}
					</p>
					<p className={styles.email}>
						Signed in as <strong>{account.email}</strong>
					</p>
					{error && (
						<p className={styles.error} role="alert">
							{error}
						</p>
					)}
					<Button onClick={signOut} disabled={pending}>
						{pending ? 'Signing out…' : 'Sign out'}
					</Button>
				</div>
			) : view === 'confirm' ? (
				<div className={styles.content}>
					<p>
						We sent a confirmation link to <strong>{sentTo}</strong>
						. Open it to finish creating your account, then sign in.
					</p>
					<Button onClick={() => show('signIn')}>
						Back to sign in
					</Button>
				</div>
			) : view === 'resetSent' ? (
				<div className={styles.content}>
					<p>
						If <strong>{sentTo}</strong> has an account, we sent it
						a link to reset the password. It may take a minute to
						arrive.
					</p>
					<Button onClick={() => show('signIn')}>
						Back to sign in
					</Button>
				</div>
			) : view === 'passwordUpdated' ? (
				<div className={styles.content}>
					<p>Your password has been updated. You're signed in.</p>
					<Button onClick={close}>Done</Button>
				</div>
			) : (
				<form key={view} className={styles.form} onSubmit={submit}>
					{view === 'forgot' && (
						<p className={styles.intro}>
							Enter your account's email and we'll send you a link
							to choose a new password.
						</p>
					)}
					{view === 'signUp' && (
						<FormField label="First name">
							{field => (
								<Input
									{...field}
									ref={firstFieldRef}
									name="firstName"
									type="text"
									autoComplete="given-name"
									required
									disabled={pending}
								/>
							)}
						</FormField>
					)}
					{view !== 'newPassword' && (
						<FormField label="Email">
							{field => (
								<Input
									{...field}
									ref={
										view === 'signUp'
											? undefined
											: firstFieldRef
									}
									name="email"
									type="email"
									autoComplete="email"
									required
									disabled={pending}
								/>
							)}
						</FormField>
					)}
					{(passwordView || view === 'newPassword') && passwordField}
					{view === 'newPassword' && (
						<FormField label="Confirm new password">
							{field => (
								<Input
									{...field}
									name="confirmPassword"
									type="password"
									autoComplete="new-password"
									required
									disabled={pending}
								/>
							)}
						</FormField>
					)}
					{shownError && (
						<p className={styles.error} role="alert">
							{shownError}
						</p>
					)}
					{submitLabels && (
						<Button
							type="submit"
							variant="primary"
							disabled={pending}
						>
							{pending ? submitLabels[1] : submitLabels[0]}
						</Button>
					)}
					{view === 'signIn' && (
						<p className={styles.switch}>
							<button
								type="button"
								className={styles.link}
								disabled={pending}
								onClick={() => show('forgot')}
							>
								Forgot your password?
							</button>
						</p>
					)}
					{(passwordView || view === 'forgot') && (
						<p className={styles.switch}>
							{view === 'signUp'
								? 'Already have an account? '
								: view === 'signIn'
									? 'New here? '
									: ''}
							<button
								type="button"
								className={styles.link}
								disabled={pending}
								onClick={() =>
									show(
										view === 'signIn' ? 'signUp' : 'signIn',
									)
								}
							>
								{view === 'signIn'
									? 'Create an account'
									: view === 'signUp'
										? 'Sign in'
										: 'Back to sign in'}
							</button>
						</p>
					)}
				</form>
			)}
		</Modal>
	)
}
