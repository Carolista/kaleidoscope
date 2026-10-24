import { useId, useRef, useState, type SubmitEvent } from 'react'
import { Button, FormField, Input, Modal, ModalHeader } from '@/ui/components'
import { useAccount } from './AccountContext'
import styles from './AccountDialog.module.css'

type View = 'signIn' | 'signUp' | 'confirm'

const TITLES: Record<View | 'account', string> = {
	signIn: 'Sign in',
	signUp: 'Create an account',
	confirm: 'Check your email',
	account: 'Your account',
}

// The one place a player signs in, creates an account, or signs out. Everything
// else in the app works without it.
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
	if (open && !pending && signedIn !== (account.status === 'signedIn')) {
		setSignedIn(account.status === 'signedIn')
	}
	const title = signedIn ? TITLES.account : TITLES[view]

	function show(next: View) {
		setView(next)
		setError('')
	}

	function reset() {
		attempt.current++
		show('signIn')
		setSentTo('')
		setPending(false)
	}

	async function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		const values = new FormData(event.currentTarget)
		const email = String(values.get('email')).trim()
		const password = String(values.get('password'))
		const started = attempt.current
		setPending(true)
		setError('')
		if (view === 'signUp') {
			const result = await account.signUp({
				firstName: String(values.get('firstName')).trim(),
				email,
				password,
			})
			if (attempt.current !== started) return
			if (result.status === 'error') {
				setError(result.message)
				setPending(false)
			} else if (result.status === 'confirm') {
				setSentTo(email)
				setView('confirm')
				setPending(false)
			} else onClose() // stays pending until the dialog has finished closing
		} else {
			const result = await account.signIn({ email, password })
			if (attempt.current !== started) return
			if (result.status === 'error') {
				setError(result.message)
				setPending(false)
			} else onClose()
		}
	}

	async function signOut() {
		const started = attempt.current
		setPending(true)
		setError('')
		const result = await account.signOut()
		if (attempt.current !== started) return
		if (result.status === 'error') {
			setError(result.message)
			setPending(false)
		} else onClose()
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			onAfterClose={reset}
			labelledBy={titleId}
			className={styles.dialog}
			initialFocusRef={firstFieldRef}
			header={
				<ModalHeader
					title={title}
					titleId={titleId}
					closeLabel="Close account dialog"
					onClose={onClose}
				/>
			}
		>
			{signedIn ? (
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
			) : (
				<form key={view} className={styles.form} onSubmit={submit}>
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
					<FormField label="Email">
						{field => (
							<Input
								{...field}
								ref={
									view === 'signIn'
										? firstFieldRef
										: undefined
								}
								name="email"
								type="email"
								autoComplete="email"
								required
								disabled={pending}
							/>
						)}
					</FormField>
					<FormField
						label="Password"
						help={
							view === 'signUp'
								? 'At least 8 characters.'
								: undefined
						}
					>
						{field => (
							<Input
								{...field}
								name="password"
								type="password"
								autoComplete={
									view === 'signUp'
										? 'new-password'
										: 'current-password'
								}
								minLength={view === 'signUp' ? 8 : undefined}
								required
								disabled={pending}
							/>
						)}
					</FormField>
					{error && (
						<p className={styles.error} role="alert">
							{error}
						</p>
					)}
					<Button type="submit" variant="primary" disabled={pending}>
						{view === 'signUp'
							? pending
								? 'Creating account…'
								: 'Create account'
							: pending
								? 'Signing in…'
								: 'Sign in'}
					</Button>
					<p className={styles.switch}>
						{view === 'signUp'
							? 'Already have an account? '
							: 'New here? '}
						<button
							type="button"
							className={styles.link}
							disabled={pending}
							onClick={() =>
								show(view === 'signUp' ? 'signIn' : 'signUp')
							}
						>
							{view === 'signUp'
								? 'Sign in'
								: 'Create an account'}
						</button>
					</p>
				</form>
			)}
		</Modal>
	)
}
