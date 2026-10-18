import { useEffect, useState, type FormEvent } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { getSupabaseClient } from '../../services/supabaseClient'
import styles from './AdminPortal.module.css'
import PuzzleAuthoring from './PuzzleAuthoring'

type RoleCheck =
	| { token: string; status: 'allowed' }
	| { token: string; status: 'denied' }
	| { token: string; status: 'error'; message: string }

function AdminSession({
	client,
}: {
	readonly client: SupabaseClient<Database>
}) {
	const [session, setSession] = useState<Session | null>(null)
	const [loading, setLoading] = useState(true)
	const [role, setRole] = useState<RoleCheck | null>(null)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const [retry, setRetry] = useState(0)

	useEffect(() => {
		let active = true
		let receivedEvent = false
		const { data } = client.auth.onAuthStateChange(
			(_event, nextSession) => {
				receivedEvent = true
				if (!active) return
				setSession(nextSession)
				setLoading(false)
				setError('')
			},
		)
		void client.auth
			.getSession()
			.then(({ data, error }) => {
				if (!active || receivedEvent) return
				setSession(error ? null : data.session)
				setError(error?.message ?? '')
				setLoading(false)
			})
			.catch((cause: unknown) => {
				if (!active || receivedEvent) return
				setError(
					cause instanceof Error
						? cause.message
						: 'Unable to restore the admin session.',
				)
				setLoading(false)
			})
		return () => {
			active = false
			data.subscription.unsubscribe()
		}
	}, [client])

	useEffect(() => {
		if (!session) return
		let active = true
		const token = session.access_token
		const userId = session.user.id
		async function checkRole() {
			try {
				const { data, error } = await client
					.from('admin_account')
					.select('user_id')
					.eq('user_id', userId)
					.maybeSingle()
				if (!active) return
				setRole(
					error
						? { token, status: 'error', message: error.message }
						: { token, status: data ? 'allowed' : 'denied' },
				)
			} catch (cause) {
				if (!active) return
				setRole({
					token,
					status: 'error',
					message:
						cause instanceof Error
							? cause.message
							: 'Unable to verify admin access.',
				})
			}
		}
		void checkRole()
		return () => {
			active = false
		}
	}, [client, session, retry])

	async function signIn(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const form = event.currentTarget
		const values = new FormData(form)
		setBusy(true)
		setError('')
		try {
			const { error } = await client.auth.signInWithPassword({
				email: String(values.get('email')).trim(),
				password: String(values.get('password')),
			})
			if (error) setError(error.message)
			else form.reset()
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: 'Unable to sign in. Please try again.',
			)
		} finally {
			setBusy(false)
		}
	}

	async function signOut() {
		setBusy(true)
		setError('')
		try {
			const { error } = await client.auth.signOut({ scope: 'local' })
			if (error) setError(error.message)
			else {
				setSession(null)
				setRole(null)
			}
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: 'Unable to sign out. Please try again.',
			)
		} finally {
			setBusy(false)
		}
	}

	const checkedRole = role?.token === session?.access_token ? role : null
	return (
		<>
			{error && <p role="alert">{error}</p>}
			{loading ? (
				<p role="status">Restoring session…</p>
			) : !session ? (
				<form onSubmit={signIn} className={styles.form}>
					<label htmlFor="admin-email">Email</label>
					<input
						id="admin-email"
						name="email"
						type="email"
						autoComplete="username"
						required
						disabled={busy}
					/>
					<label htmlFor="admin-password">Password</label>
					<input
						id="admin-password"
						name="password"
						type="password"
						autoComplete="current-password"
						required
						disabled={busy}
					/>
					<button type="submit" disabled={busy}>
						{busy ? 'Signing in…' : 'Sign in'}
					</button>
					<p>
						Use your existing admin account. Player registration is
						not available here.
					</p>
				</form>
			) : (
				<>
					<p>Signed in as {session.user.email}</p>
					{!checkedRole ? (
						<p role="status">Checking admin access…</p>
					) : checkedRole.status === 'allowed' ? (
						<section aria-labelledby="admin-ready">
							<h2 id="admin-ready">Admin access verified</h2>
							<p>
								Your workspace is connected. Catalog, set, and
								reward tools will be added after the puzzle lab.
							</p>
							<PuzzleAuthoring
								key={session.user.id}
								client={client}
							/>
						</section>
					) : checkedRole.status === 'denied' ? (
						<p role="alert">
							This account does not have admin access. Sign out to
							use your admin account.
						</p>
					) : (
						<div>
							<p role="alert">
								Unable to verify admin access:{' '}
								{checkedRole.message}
							</p>
							<button
								type="button"
								onClick={() => {
									setRole(null)
									setRetry(value => value + 1)
								}}
							>
								Retry access check
							</button>
						</div>
					)}
					<button
						type="button"
						onClick={() => {
							void signOut()
						}}
						disabled={busy}
					>
						{busy ? 'Signing out…' : 'Sign out on this device'}
					</button>
				</>
			)}
		</>
	)
}

export default function AdminPortal() {
	const [connection] = useState(() => {
		try {
			return { client: getSupabaseClient() }
		} catch (cause) {
			return {
				error:
					cause instanceof Error
						? cause.message
						: 'Unable to configure Supabase.',
			}
		}
	})
	return (
		<main className={styles.page}>
			<a href="#">Back to Kaleidoscope</a>
			<h1>Kaleidoscope Admin</h1>
			{connection.client ? (
				<AdminSession client={connection.client} />
			) : (
				<p role="alert">{connection.error}</p>
			)}
		</main>
	)
}
