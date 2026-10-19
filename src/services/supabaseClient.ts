import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

let client: SupabaseClient<Database> | undefined

export function getSupabaseClient(): SupabaseClient<Database> {
	if (client) return client
	const url = import.meta.env.VITE_SUPABASE_URL?.trim()
	const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
	if (!url || !key) {
		throw new Error(
			'Admin sign-in requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local. Restart Vite after configuring them.',
		)
	}
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
	client = createClient<Database>(url, key, {
		auth: {
			storageKey: 'kaleidoscope-admin-auth',
			detectSessionInUrl: false,
		},
	})
	return client
}
