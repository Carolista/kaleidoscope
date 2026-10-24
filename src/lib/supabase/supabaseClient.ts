import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database'

let client: SupabaseClient<Database> | undefined
let guestClient: SupabaseClient<Database> | undefined
let playerClient: SupabaseClient<Database> | undefined

function readConfiguration(missingMessage: string) {
	const url = import.meta.env.VITE_SUPABASE_URL?.trim()
	const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
	if (!url || !key) throw new Error(missingMessage)
	if (key.startsWith('sb_secret_')) {
		throw new Error(
			'Use a browser-safe publishable key, never a secret key.',
		)
	}
	if (!key.startsWith('sb_publishable_')) {
		throw new Error(
			'Use the Supabase publishable key (sb_publishable_...), not a legacy JWT or service-role key.',
		)
	}
	const parsedUrl = new URL(url)
	if (
		parsedUrl.protocol !== 'https:' &&
		!(
			parsedUrl.protocol === 'http:' &&
			['localhost', '127.0.0.1'].includes(parsedUrl.hostname)
		)
	) {
		throw new Error(
			'The Supabase project URL must use HTTPS (except local development).',
		)
	}
	return { url, key }
}

export function getSupabaseClient(): SupabaseClient<Database> {
	if (client) return client
	const { url, key } = readConfiguration(
		'Admin sign-in requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local. Restart Vite after configuring them.',
	)
	client = createClient<Database>(url, key, {
		auth: {
			storageKey: 'kaleidoscope-admin-auth',
			detectSessionInUrl: false,
		},
	})
	return client
}

// The player's client never stores or reuses a session, so it reads exactly
// what a guest can, even in a browser where an admin is signed in.
export function getGuestClient(): SupabaseClient<Database> {
	if (guestClient) return guestClient
	const { url, key } = readConfiguration(
		'Loading puzzles requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local. Restart Vite after configuring them.',
	)
	guestClient = createClient<Database>(url, key, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false,
		},
	})
	return guestClient
}

// The signed-in player's client. Its session lives under its own storage key so
// it never mixes with the admin's, and the PKCE flow returns confirmation links
// as a `?code=` query, which does not collide with the `#/admin` hash route.
export function getPlayerClient(): SupabaseClient<Database> {
	if (playerClient) return playerClient
	const { url, key } = readConfiguration(
		'Accounts require VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local. Restart Vite after configuring them.',
	)
	playerClient = createClient<Database>(url, key, {
		auth: {
			storageKey: 'kaleidoscope-player-auth',
			flowType: 'pkce',
			detectSessionInUrl: true,
		},
	})
	return playerClient
}
