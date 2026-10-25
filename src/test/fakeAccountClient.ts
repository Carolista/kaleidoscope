import { vi } from 'vitest'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'

type AuthListener = (event: string, session: Session | null) => void

export function sessionFor(
	email: string,
	firstName?: string,
	newEmail?: string,
) {
	return {
		user: {
			email,
			new_email: newEmail,
			user_metadata: firstName ? { first_name: firstName } : {},
		},
	} as unknown as Session
}

export function fakeClient(initial: Session | null = null) {
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
