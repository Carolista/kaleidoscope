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

it('creates a separate guest client that keeps no session', async () => {
	vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
	vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_example')
	const { getGuestClient, getSupabaseClient } =
		await import('./supabaseClient')
	expect(getGuestClient()).toBe(getGuestClient())
	getSupabaseClient()
	expect(createClient).toHaveBeenCalledTimes(2)
	expect(createClient).toHaveBeenCalledWith(
		'https://example.supabase.co',
		'sb_publishable_example',
		{
			auth: {
				persistSession: false,
				autoRefreshToken: false,
				detectSessionInUrl: false,
			},
		},
	)
})

it('reports missing configuration for guests with player wording', async () => {
	const { getGuestClient } = await import('./supabaseClient')
	expect(getGuestClient).toThrow('Loading puzzles requires')
})

it('creates a player client with its own persisted session', async () => {
	vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
	vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_example')
	const { getPlayerClient } = await import('./supabaseClient')
	expect(getPlayerClient()).toBe(getPlayerClient())
	expect(createClient).toHaveBeenCalledOnce()
	expect(createClient).toHaveBeenCalledWith(
		'https://example.supabase.co',
		'sb_publishable_example',
		{
			auth: {
				storageKey: 'kaleidoscope-player-auth',
				flowType: 'pkce',
				detectSessionInUrl: true,
			},
		},
	)
})

it('reports missing configuration for accounts', async () => {
	const { getPlayerClient } = await import('./supabaseClient')
	expect(getPlayerClient).toThrow('Accounts require')
})

it('requires HTTPS outside localhost', async () => {
	vi.stubEnv('VITE_SUPABASE_URL', 'http://example.supabase.co')
	vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_example')
	const { getSupabaseClient } = await import('./supabaseClient')
	expect(getSupabaseClient).toThrow('must use HTTPS')
})
