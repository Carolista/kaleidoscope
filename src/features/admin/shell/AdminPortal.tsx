import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
	type SubmitEvent,
	type ReactNode,
} from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { getSupabaseClient } from '@/lib/supabase'
import { getThemeColors } from '@/domain/palettes'
import { AdminForm, AdminIconButton } from '@/features/admin/common'
import styles from './AdminPortal.module.css'
import AdminWorkspace from './AdminWorkspace'
import {
	NavigationGuardBoundary,
	NavigationGuardDialog,
	useNavigationGuard,
	useUnsavedDraft,
} from '@/ui/navigation'
import { Button, FormField, Input, Loading } from '@/ui/components'
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
	light,
	onToggleTheme,
}: {
	readonly client: SupabaseClient<Database>
	readonly light: boolean
	readonly onToggleTheme: () => void
}) {
	const [session, setSession] = useState<Session | null>(null)
	const [loading, setLoading] = useState(true)
	const [role, setRole] = useState<RoleCheck | null>(null)
	const [error, setError] = useState('')
	const [pending, setPending] = useState<string | null>(null)
	const busy = pending !== null
	const [retry, setRetry] = useState(0)
	const signingOut = useRef(false)
	const { requestNavigation } = useNavigationGuard()
	useUnsavedDraft({ dirty: false, pending: busy })

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
		setPending('Signing in…')
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
			setPending(null)
		}
	}

	async function signOut() {
		if (signingOut.current) return
		signingOut.current = true
		setPending('Signing out…')
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
			signingOut.current = false
			setPending(null)
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
								requestNavigation(() => {
									void signOut()
								})
							}}
							disabled={busy}
						/>
					</>
				)}
			</AdminHeader>
			{error && <p role="alert">{error}</p>}
			{pending && <Loading label={pending} />}
			{loading ? (
				<Loading label="Restoring session…" />
			) : !session ? (
				<AdminForm onSubmit={signIn}>
					<FormField id="admin-email" label="Email">
						{field => (
							<Input
								{...field}
								name="email"
								type="email"
								autoComplete="username"
								required
								disabled={busy}
							/>
						)}
					</FormField>
					<FormField id="admin-password" label="Password">
						{field => (
							<Input
								{...field}
								name="password"
								type="password"
								autoComplete="current-password"
								required
								disabled={busy}
							/>
						)}
					</FormField>
					<Button type="submit" disabled={busy}>
						Sign in
					</Button>
					<p>
						Use your existing admin account. Player registration is
						not available here.
					</p>
				</AdminForm>
			) : (
				<>
					{!checkedRole ? (
						<Loading label="Checking admin access…" />
					) : checkedRole.status === 'allowed' ? (
						<div inert={busy}>
							<AdminWorkspace
								key={session.user.id}
								client={client}
							/>
						</div>
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

function AdminPage() {
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
			<NavigationGuardDialog />
		</main>
	)
}

export default function AdminPortal() {
	return (
		<NavigationGuardBoundary>
			<AdminPage />
		</NavigationGuardBoundary>
	)
}
