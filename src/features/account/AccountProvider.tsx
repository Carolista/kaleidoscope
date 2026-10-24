import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { getPlayerClient, type Database } from '@/lib/supabase'
import {
	AccountContext,
	UNAVAILABLE,
	type AccountApi,
	type AuthResult,
	type SignInDetails,
	type SignUpDetails,
	type SignUpResult,
} from './AccountContext'

function failure(cause: unknown, fallback: string) {
	return {
		status: 'error' as const,
		message:
			cause instanceof Error && cause.message ? cause.message : fallback,
	}
}

// A gateway timeout or other server failure has no useful message of its own (a
// timed-out response even arrives as the text "{}"), so players get ours instead.
function authFailure(
	error: { readonly message?: string; readonly status?: number },
	fallback: string,
) {
	const message = error.message?.trim()
	const unusable =
		!message || message.startsWith('{') || (error.status ?? 0) >= 500
	return { status: 'error' as const, message: unusable ? fallback : message }
}

function readFirstName(session: Session | null): string | null {
	const name: unknown = session?.user.user_metadata?.first_name
	return typeof name === 'string' && name.trim() ? name.trim() : null
}

function resolveClient(client?: SupabaseClient<Database>) {
	if (client) return client
	try {
		return getPlayerClient()
	} catch {
		// Without Supabase configured, the app simply stays guest-only.
		return null
	}
}

function createActions(client: SupabaseClient<Database>) {
	async function signUp({
		firstName,
		email,
		password,
	}: SignUpDetails): Promise<SignUpResult> {
		try {
			const { data, error } = await client.auth.signUp({
				email,
				password,
				options: {
					data: { first_name: firstName },
					emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
				},
			})
			if (error) {
				return authFailure(
					error,
					"We couldn't create your account right now. Please try again in a little while.",
				)
			}
			if (data.session) return { status: 'signedIn' }
			// With confirmation required, an address that already has an account comes
			// back as a user with no identities instead of an error.
			if (data.user?.identities?.length === 0) {
				return {
					status: 'error',
					message:
						'An account with this email may already exist. Try signing in instead.',
				}
			}
			return { status: 'confirm' }
		} catch (cause) {
			return failure(
				cause,
				'Unable to create the account. Please try again.',
			)
		}
	}

	async function signIn(details: SignInDetails): Promise<AuthResult> {
		try {
			const { error } = await client.auth.signInWithPassword(details)
			return error
				? authFailure(
						error,
						"We couldn't sign you in right now. Please try again in a little while.",
					)
				: { status: 'ok' }
		} catch (cause) {
			return failure(cause, 'Unable to sign in. Please try again.')
		}
	}

	async function signOut(): Promise<AuthResult> {
		try {
			const { error } = await client.auth.signOut({ scope: 'local' })
			return error
				? authFailure(
						error,
						"We couldn't sign you out right now. Please try again.",
					)
				: { status: 'ok' }
		} catch (cause) {
			return failure(cause, 'Unable to sign out. Please try again.')
		}
	}

	return { signUp, signIn, signOut }
}

// Keeps who is signed in (if anyone) for the whole player app. Guests are the
// normal state: nothing here is required to play, and no guest progress is read,
// moved, or merged. Importing it is a separate, explicit step.
export function AccountProvider({
	client: suppliedClient,
	children,
}: {
	readonly client?: SupabaseClient<Database>
	readonly children: ReactNode
}) {
	const [client] = useState(() => resolveClient(suppliedClient))
	const [session, setSession] = useState<Session | null>(null)
	const [loading, setLoading] = useState(client !== null)

	useEffect(() => {
		if (!client) return
		let active = true
		let receivedEvent = false
		const { data } = client.auth.onAuthStateChange((_event, next) => {
			receivedEvent = true
			if (!active) return
			setSession(next)
			setLoading(false)
		})
		client.auth
			.getSession()
			.then(({ data: restored }) => {
				if (active && !receivedEvent) setSession(restored.session)
			})
			.catch(() => undefined)
			.finally(() => {
				if (active) setLoading(false)
			})
		return () => {
			active = false
			data.subscription.unsubscribe()
		}
	}, [client])

	const actions = useMemo(
		() => (client ? createActions(client) : null),
		[client],
	)
	const api = useMemo<AccountApi>(
		() =>
			actions
				? {
						status: loading
							? 'loading'
							: session
								? 'signedIn'
								: 'signedOut',
						email: session?.user.email ?? null,
						firstName: readFirstName(session),
						...actions,
					}
				: UNAVAILABLE,
		[actions, loading, session],
	)

	return (
		<AccountContext.Provider value={api}>
			{children}
		</AccountContext.Provider>
	)
}
