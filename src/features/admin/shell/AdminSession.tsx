import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import {
	AdminForm,
	AdminIconButton,
	errorMessage,
} from '@/features/admin/common'
import styles from './AdminSession.module.css'
import AdminHeader from './AdminHeader'
import AdminWorkspace from './AdminWorkspace'
import { clearUserDrafts, DraftScopeProvider } from '@/features/admin/drafts'
import { useNavigationGuard, useUnsavedDraft } from '@/ui/navigation'
import { Button, FormField, Input, Loading } from '@/ui/components'
import { faRightFromBracket } from '@fortawesome/pro-solid-svg-icons'

// Keyed by user, not access token: a background token refresh must not
// discard the verified role and unmount the workspace.
type RoleCheck =
	| { userId: string; status: 'allowed' }
	| { userId: string; status: 'denied' }
	| { userId: string; status: 'error'; message: string }

export default function AdminSession({
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
					errorMessage(cause, 'Unable to restore the admin session.'),
				)
				setLoading(false)
			})
		return () => {
			active = false
			data.subscription.unsubscribe()
		}
	}, [client])

	const userId = session?.user.id
	useEffect(() => {
		if (!userId) return
		const checkedUserId = userId
		let active = true
		async function checkRole() {
			try {
				const { data, error } = await client
					.from('admin_account')
					.select('user_id')
					.eq('user_id', checkedUserId)
					.maybeSingle()
				if (!active) return
				setRole(
					error
						? {
								userId: checkedUserId,
								status: 'error',
								message: error.message,
							}
						: {
								userId: checkedUserId,
								status: data ? 'allowed' : 'denied',
							},
				)
			} catch (cause) {
				if (!active) return
				setRole({
					userId: checkedUserId,
					status: 'error',
					message: errorMessage(
						cause,
						'Unable to verify admin access.',
					),
				})
			}
		}
		void checkRole()
		return () => {
			active = false
		}
	}, [client, userId, retry])

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
				errorMessage(cause, 'Unable to sign in. Please try again.'),
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
				// An explicit sign-out already confirmed discarding unsaved work.
				if (userId) clearUserDrafts(userId)
				setSession(null)
				setRole(null)
			}
		} catch (cause) {
			setError(
				errorMessage(cause, 'Unable to sign out. Please try again.'),
			)
		} finally {
			signingOut.current = false
			setPending(null)
		}
	}

	const checkedRole = role?.userId === userId ? role : null
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
							<DraftScopeProvider userId={session.user.id}>
								<AdminWorkspace
									key={session.user.id}
									client={client}
								/>
							</DraftScopeProvider>
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
