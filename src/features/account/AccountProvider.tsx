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

// An email link that failed (expired, or already used, for instance by a mail
// scanner) returns to the app with the reason in the hash or the query.
function readLinkError(): string | null {
	const { hash, search } = window.location
	const params = new URLSearchParams(
		hash.startsWith('#error') ? hash.slice(1) : search,
	)
	if (!params.has('error') && !params.has('error_code')) return null
	const expired = ['otp_expired', 'access_denied'].includes(
		params.get('error_code') ?? params.get('error') ?? '',
	)
	return expired
		? 'That link has expired or was already used.'
		: "We couldn't use that link."
}

function clearLinkErrorFromUrl() {
	const url = new URL(window.location.href)
	if (url.hash.startsWith('#error')) url.hash = ''
	;['error', 'error_code', 'error_description'].forEach(key =>
		url.searchParams.delete(key),
	)
	window.history.replaceState(window.history.state, '', url)
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

// This device has had a signed-in player. Kept for good: it only lets the app remind a
// guest that they may have an account, and holds nothing about who it was.
const KNOWN_ACCOUNT_KEY = 'kaleidoscope:known-account'
// Signing out on purpose in this browser session means the player knows they are a guest.
const SIGNED_OUT_HERE_KEY = 'kaleidoscope:signed-out-here'

function readFlag(storage: () => Storage, key: string) {
	try {
		return storage().getItem(key) === '1'
	} catch {
		return false
	}
}

function writeFlag(storage: () => Storage, key: string) {
	try {
		storage().setItem(key, '1')
	} catch {
		// The reminder is a courtesy; losing it is fine.
	}
}

function createActions(
	client: SupabaseClient<Database>,
	onSignedOut: () => void,
) {
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
			if (error)
				return authFailure(
					error,
					"We couldn't sign you out right now. Please try again.",
				)
			onSignedOut()
			return { status: 'ok' }
		} catch (cause) {
			return failure(cause, 'Unable to sign out. Please try again.')
		}
	}

	async function requestPasswordReset(email: string): Promise<AuthResult> {
		try {
			// Supabase answers the same whether or not the address has an account.
			const { error } = await client.auth.resetPasswordForEmail(email, {
				redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
			})
			return error
				? authFailure(
						error,
						"We couldn't send the reset email right now. Please try again in a little while.",
					)
				: { status: 'ok' }
		} catch (cause) {
			return failure(
				cause,
				'Unable to send the reset email. Please try again.',
			)
		}
	}

	async function updatePassword(password: string): Promise<AuthResult> {
		try {
			const { error } = await client.auth.updateUser({ password })
			return error
				? authFailure(
						error,
						"We couldn't update your password right now. Please try again in a little while.",
					)
				: { status: 'ok' }
		} catch (cause) {
			return failure(
				cause,
				'Unable to update the password. Please try again.',
			)
		}
	}

	return { signUp, signIn, signOut, requestPasswordReset, updatePassword }
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
	const [recovering, setRecovering] = useState(false)
	const [linkError, setLinkError] = useState(readLinkError)
	const [knownAccount] = useState(() =>
		readFlag(() => localStorage, KNOWN_ACCOUNT_KEY),
	)
	const [signedOutHere, setSignedOutHere] = useState(() =>
		readFlag(() => sessionStorage, SIGNED_OUT_HERE_KEY),
	)

	useEffect(() => {
		if (!client) return
		let active = true
		let receivedEvent = false
		const { data } = client.auth.onAuthStateChange((event, next) => {
			receivedEvent = true
			if (!active) return
			setSession(next)
			setLoading(false)
			if (event === 'PASSWORD_RECOVERY') setRecovering(true)
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

	useEffect(() => {
		if (session) writeFlag(() => localStorage, KNOWN_ACCOUNT_KEY)
	}, [session])

	const actions = useMemo(
		() =>
			client
				? createActions(client, () => {
						writeFlag(() => sessionStorage, SIGNED_OUT_HERE_KEY)
						setSignedOutHere(true)
					})
				: null,
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
						userId: session?.user.id ?? null,
						email: session?.user.email ?? null,
						firstName: readFirstName(session),
						returningGuest:
							!loading &&
							!session &&
							knownAccount &&
							!signedOutHere,
						recovering,
						linkError,
						endRecovery: () => setRecovering(false),
						dismissLinkError: () => {
							if (!linkError) return
							setLinkError(null)
							clearLinkErrorFromUrl()
						},
						...actions,
					}
				: UNAVAILABLE,
		[
			actions,
			loading,
			session,
			recovering,
			linkError,
			knownAccount,
			signedOutHere,
		],
	)

	return (
		<AccountContext.Provider value={api}>
			{children}
		</AccountContext.Provider>
	)
}
