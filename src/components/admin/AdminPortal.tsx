import {
	useEffect,
	useLayoutEffect,
	useState,
	type CSSProperties,
	type SubmitEvent,
	type ReactNode,
} from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { getSupabaseClient } from '../../services/supabaseClient'
import { getThemeColors } from '../../state/theme'
import styles from './AdminPortal.module.css'
import PuzzleAuthoring from './PuzzleAuthoring'
import { confirmDiscardDraft } from './useUnsavedDraft'
import AdminIconButton from './AdminIconButton'
import { Button, Input } from '@shared'
import {
	faRightFromBracket,
	faSun,
	faMoon,
} from '@fortawesome/pro-solid-svg-icons'

type RoleCheck =
	| { token: string; status: 'allowed' }
	| { token: string; status: 'denied' }
	| { token: string; status: 'error'; message: string }

function AdminHeader({
	light,
	onToggleTheme,
	children,
}: {
	readonly light: boolean
	readonly onToggleTheme: () => void
	readonly children?: ReactNode
}) {
	return (
		<header className={styles.header}>
			<div className={styles.headerBrand}>
				<a
					href="#"
					className={styles.homeButton}
					aria-label="Back to Kaleidoscope"
					title="Back to Kaleidoscope"
				>
					<img
						src={`${import.meta.env.BASE_URL}favicon.svg`}
						alt=""
					/>
				</a>
				<h1>Kaleidoscope Admin</h1>
			</div>
			<div className={styles.sessionBar}>
				{children}
				<AdminIconButton
					icon={light ? faMoon : faSun}
					label={
						light ? 'Switch to dark mode' : 'Switch to light mode'
					}
					onClick={onToggleTheme}
				/>
			</div>
		</header>
	)
}

function AdminSession({
	client,
	onDirtyChange,
	light,
	onToggleTheme,
}: {
	readonly client: SupabaseClient<Database>
	readonly onDirtyChange?: (dirty: boolean) => void
	readonly light: boolean
	readonly onToggleTheme: () => void
}) {
	const [session, setSession] = useState<Session | null>(null)
	const [loading, setLoading] = useState(true)
	const [role, setRole] = useState<RoleCheck | null>(null)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const [retry, setRetry] = useState(0)
	const [dirty, setDirty] = useState(false)
	useEffect(() => {
		onDirtyChange?.(dirty)
		return () => onDirtyChange?.(false)
	}, [dirty, onDirtyChange])

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

	async function signIn(event: SubmitEvent<HTMLFormElement>) {
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
		if (dirty && !confirmDiscardDraft()) return
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
			<AdminHeader light={light} onToggleTheme={onToggleTheme}>
				{session && (
					<>
						<span className={styles.accountName}>
							{session.user.email}
						</span>
						<AdminIconButton
							icon={faRightFromBracket}
							label={
								busy
									? 'Signing out…'
									: 'Sign out on this device'
							}
							onClick={() => {
								void signOut()
							}}
							disabled={busy}
						/>
					</>
				)}
			</AdminHeader>
			{error && <p role="alert">{error}</p>}
			{loading ? (
				<p role="status">Restoring session…</p>
			) : !session ? (
				<form onSubmit={signIn} className={styles.form}>
					<label htmlFor="admin-email">Email</label>
					<Input
						id="admin-email"
						name="email"
						type="email"
						autoComplete="username"
						required
						disabled={busy}
					/>
					<label htmlFor="admin-password">Password</label>
					<Input
						id="admin-password"
						name="password"
						type="password"
						autoComplete="current-password"
						required
						disabled={busy}
					/>
					<Button type="submit" disabled={busy}>
						{busy ? 'Signing in…' : 'Sign in'}
					</Button>
					<p>
						Use your existing admin account. Player registration is
						not available here.
					</p>
				</form>
			) : (
				<>
					{!checkedRole ? (
						<p role="status">Checking admin access…</p>
					) : checkedRole.status === 'allowed' ? (
						<>
							<PuzzleAuthoring
								key={session.user.id}
								client={client}
								onDirtyChange={setDirty}
							/>
						</>
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
							<Button
								type="button"
								onClick={() => {
									setRole(null)
									setRetry(value => value + 1)
								}}
							>
								Retry access check
							</Button>
						</div>
					)}
				</>
			)}
		</>
	)
}

export default function AdminPortal({
	onDirtyChange,
}: {
	readonly onDirtyChange?: (dirty: boolean) => void
}) {
	const [light, setLight] = useState(false)
	const { base, accent } = getThemeColors(!light)
	useLayoutEffect(() => {
		document.documentElement.style.backgroundColor = base
		document.body.style.backgroundColor = base
	}, [base])
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
		<main
			className={styles.page}
			data-theme={light ? 'light' : 'dark'}
			style={{ '--base': base, '--accent': accent } as CSSProperties}
		>
			{connection.client ? (
				<AdminSession
					client={connection.client}
					onDirtyChange={onDirtyChange}
					light={light}
					onToggleTheme={() => setLight(value => !value)}
				/>
			) : (
				<>
					<AdminHeader
						light={light}
						onToggleTheme={() => setLight(value => !value)}
					/>
					<p role="alert">{connection.error}</p>
				</>
			)}
		</main>
	)
}
