import { beforeEach, expect, it, vi } from 'vitest'

const createClient = vi.hoisted(() => vi.fn(() => ({ marker: 'typed-client' })))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

beforeEach(() => {
	vi.resetModules()
	vi.clearAllMocks()
	vi.stubEnv('VITE_SUPABASE_URL', '')
	vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
})

it('reports missing configuration', async () => {
	const { getSupabaseClient } = await import('./supabaseClient')
	expect(getSupabaseClient).toThrow('Admin sign-in requires')
	expect(createClient).not.toHaveBeenCalled()
})

it.each(['sb_secret_private', 'eyJlegacyJwt'])(
	'rejects unsafe or legacy keys: %s',
	async key => {
		vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
		vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', key)
		const { getSupabaseClient } = await import('./supabaseClient')
		expect(getSupabaseClient).toThrow()
		expect(createClient).not.toHaveBeenCalled()
	},
)

it('creates a single typed client with isolated auth storage', async () => {
	vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
	vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_example')
	const { getSupabaseClient } = await import('./supabaseClient')
	expect(getSupabaseClient()).toBe(getSupabaseClient())
	expect(createClient).toHaveBeenCalledOnce()
	expect(createClient).toHaveBeenCalledWith(
		'https://example.supabase.co',
		'sb_publishable_example',
		{
			auth: {
				storageKey: 'kaleidoscope-admin-auth',
				detectSessionInUrl: false,
			},
		},
	)
})

it('requires HTTPS outside localhost', async () => {
	vi.stubEnv('VITE_SUPABASE_URL', 'http://example.supabase.co')
	vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_example')
	const { getSupabaseClient } = await import('./supabaseClient')
	expect(getSupabaseClient).toThrow('must use HTTPS')
})
