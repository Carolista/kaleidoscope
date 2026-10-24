import { createContext, useContext } from 'react'

export interface SignUpDetails {
	readonly firstName: string
	readonly email: string
	readonly password: string
}

export interface SignInDetails {
	readonly email: string
	readonly password: string
}

// `confirm` means the account exists but the email must be confirmed before sign-in.
export type SignUpResult =
	| { readonly status: 'signedIn' }
	| { readonly status: 'confirm' }
	| { readonly status: 'error'; readonly message: string }

export type AuthResult =
	| { readonly status: 'ok' }
	| { readonly status: 'error'; readonly message: string }

export interface AccountApi {
	// `unavailable` is a build without Supabase configured; the app stays guest-only.
	readonly status: 'unavailable' | 'loading' | 'signedOut' | 'signedIn'
	readonly email: string | null
	readonly firstName: string | null
	// True from the moment a password-reset link is followed until the dialog that
	// sets the new password is closed.
	readonly recovering: boolean
	// Set when an email link came back expired or already used.
	readonly linkError: string | null
	readonly signUp: (details: SignUpDetails) => Promise<SignUpResult>
	readonly signIn: (details: SignInDetails) => Promise<AuthResult>
	readonly signOut: () => Promise<AuthResult>
	readonly requestPasswordReset: (email: string) => Promise<AuthResult>
	readonly updatePassword: (password: string) => Promise<AuthResult>
	readonly endRecovery: () => void
	readonly dismissLinkError: () => void
}

const UNAVAILABLE_ERROR = {
	status: 'error',
	message: 'Accounts are not available right now.',
} as const

export const UNAVAILABLE: AccountApi = {
	status: 'unavailable',
	email: null,
	firstName: null,
	recovering: false,
	linkError: null,
	signUp: () => Promise.resolve(UNAVAILABLE_ERROR),
	signIn: () => Promise.resolve(UNAVAILABLE_ERROR),
	signOut: () => Promise.resolve(UNAVAILABLE_ERROR),
	requestPasswordReset: () => Promise.resolve(UNAVAILABLE_ERROR),
	updatePassword: () => Promise.resolve(UNAVAILABLE_ERROR),
	endRecovery: () => undefined,
	dismissLinkError: () => undefined,
}

export const AccountContext = createContext<AccountApi>(UNAVAILABLE)

export function useAccount(): AccountApi {
	return useContext(AccountContext)
}
