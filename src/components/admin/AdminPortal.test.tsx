import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import AdminPortal from './AdminPortal'

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	signInWithPassword: vi.fn(),
	signOut: vi.fn(),
	from: vi.fn(),
	maybeSingle: vi.fn(),
	unsubscribe: vi.fn(),
	getClient: vi.fn(),
	palettes: vi.fn(),
}))

let authCallback: (event: AuthChangeEvent, session: Session | null) => void
vi.mock('../../services/puzzleLibrary', () => ({
	loadPuzzleDrafts: async () => [],
}))
vi.mock('../../services/supabaseClient', () => ({
	getSupabaseClient: () => mocks.getClient(),
}))

function session(id = 'admin'): Session {
	return {
		access_token: `token-${id}`,
		refresh_token: 'refresh',
		expires_in: 3600,
		token_type: 'bearer',
		user: {
			id,
			email: `${id}@example.com`,
			app_metadata: {},
			user_metadata: {},
			aud: 'authenticated',
			created_at: '2026-10-18T00:00:00Z',
		},
	}
}

beforeEach(() => {
	vi.resetAllMocks()
	mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
	mocks.signInWithPassword.mockResolvedValue({ error: null })
	mocks.signOut.mockResolvedValue({ error: null })
	mocks.maybeSingle.mockResolvedValue({
		data: { user_id: 'admin' },
		error: null,
	})
	afterEach(() => vi.restoreAllMocks())
	mocks.palettes.mockResolvedValue({ data: [], error: null })
	mocks.from.mockImplementation((table: string) =>
		table === 'palettes'
			? {
					select: () => ({ order: mocks.palettes }),
				}
			: {
					select: () => ({
						eq: () => ({ maybeSingle: mocks.maybeSingle }),
					}),
				},
	)
	mocks.getClient.mockReturnValue({
		auth: {
			getSession: mocks.getSession,
			signInWithPassword: mocks.signInWithPassword,
			signOut: mocks.signOut,
			onAuthStateChange: (callback: typeof authCallback) => {
				authCallback = callback
				return {
					data: { subscription: { unsubscribe: mocks.unsubscribe } },
				}
			},
		},
		from: mocks.from,
	})
})

describe('AdminPortal', () => {
	it('asks before signing out with an unsaved puzzle and preserves it when cancelled', async () => {
		mocks.getSession.mockResolvedValue({
			data: { session: session() },
			error: null,
		})
		mocks.palettes.mockResolvedValue({
			data: [
				{
					id: 'cabo',
					name: 'Cabo',
					colors: [
						'#112233',
						'#223344',
						'#334455',
						'#445566',
						'#556677',
					],
				},
			],
			error: null,
		})
		const original = mocks.from.getMockImplementation()
		mocks.from.mockImplementation((table: string) => {
			if (table !== 'puzzle_authoring') return original?.(table)
			const query = {
				eq: vi.fn().mockReturnThis(),
				order: vi.fn().mockReturnThis(),
				range: vi.fn().mockResolvedValue({ data: [], error: null }),
			}
			return { select: () => query }
		})
		render(<AdminPortal />)
		fireEvent.click(
			await screen.findByRole('button', { name: 'New puzzle' }),
		)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Randomize puzzle' }),
		)
		await screen.findByLabelText('Puzzle name')
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
		fireEvent.click(
			screen.getByRole('button', { name: 'Sign out on this device' }),
		)
		expect(confirm).toHaveBeenCalledOnce()
		expect(mocks.signOut).not.toHaveBeenCalled()
		expect(screen.getByLabelText('Puzzle name')).toBeInTheDocument()
		confirm.mockReturnValue(true)
		fireEvent.click(
			screen.getByRole('button', { name: 'Sign out on this device' }),
		)
		await screen.findByRole('button', { name: 'Sign in' })
		expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
	})

	it('explains missing configuration without a login form', () => {
		mocks.getClient.mockImplementation(() => {
			throw new Error('Missing configuration')
		})
		render(<AdminPortal />)
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Missing configuration',
		)
		expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
	})

	it('signs in with password and displays authentication errors', async () => {
		mocks.signInWithPassword.mockResolvedValue({
			error: { message: 'Invalid login credentials' },
		})
		render(<AdminPortal />)
		fireEvent.change(await screen.findByLabelText('Email'), {
			target: { value: 'admin@example.com' },
		})
		fireEvent.change(screen.getByLabelText('Password'), {
			target: { value: 'private-password' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Invalid login credentials',
		)
		expect(mocks.signInWithPassword).toHaveBeenCalledWith({
			email: 'admin@example.com',
			password: 'private-password',
		})
	})

	it('restores the owner session and verifies the database role before showing the workspace', async () => {
		mocks.getSession.mockResolvedValue({
			data: { session: session() },
			error: null,
		})
		render(<AdminPortal />)
		expect(
			await screen.findByRole('heading', {
				name: 'Admin access verified',
			}),
		).toBeInTheDocument()
		expect(mocks.from).toHaveBeenCalledWith('admin_account')
		expect(mocks.from).toHaveBeenCalledWith('palettes')
		const signOut = screen.getByRole('button', {
			name: 'Sign out on this device',
		})
		const lab = await screen.findByRole('heading', {
			name: 'Puzzle drafts',
		})
		expect(
			signOut.compareDocumentPosition(lab) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
	})

	it('denies authenticated non-admin users', async () => {
		mocks.getSession.mockResolvedValue({
			data: { session: session('player') },
			error: null,
		})
		mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
		render(<AdminPortal />)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'does not have admin access',
		)
		expect(
			screen.queryByText('Admin access verified'),
		).not.toBeInTheDocument()
		expect(mocks.from).not.toHaveBeenCalledWith('palettes')
	})

	it('fails closed on role-query failure and allows retry', async () => {
		mocks.getSession.mockResolvedValue({
			data: { session: session() },
			error: null,
		})
		mocks.maybeSingle.mockResolvedValueOnce({
			data: null,
			error: { message: 'Network unavailable' },
		})
		render(<AdminPortal />)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Network unavailable',
		)
		expect(
			screen.queryByText('Admin access verified'),
		).not.toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('button', { name: 'Retry access check' }),
		)
		expect(
			await screen.findByText('Admin access verified'),
		).toBeInTheDocument()
	})

	it('removes admin content immediately when the account changes', async () => {
		mocks.getSession.mockResolvedValue({
			data: { session: session() },
			error: null,
		})
		render(<AdminPortal />)
		await screen.findByText('Admin access verified')
		mocks.maybeSingle.mockImplementation(() => new Promise(() => {}))
		act(() => authCallback('SIGNED_IN', session('player')))
		expect(
			screen.queryByText('Admin access verified'),
		).not.toBeInTheDocument()
		expect(screen.getByRole('status')).toHaveTextContent(
			'Checking admin access',
		)
	})

	it('ignores an old role response after sign-out', async () => {
		let resolveRole!: (value: {
			data: { user_id: string }
			error: null
		}) => void
		mocks.getSession.mockResolvedValue({
			data: { session: session() },
			error: null,
		})
		mocks.maybeSingle.mockReturnValue(
			new Promise(resolve => {
				resolveRole = resolve
			}),
		)
		render(<AdminPortal />)
		await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalled())
		act(() => authCallback('SIGNED_OUT', null))
		await act(async () => {
			resolveRole({ data: { user_id: 'admin' }, error: null })
		})
		expect(
			screen.queryByText('Admin access verified'),
		).not.toBeInTheDocument()
		expect(screen.getByLabelText('Password')).toBeInTheDocument()
	})

	it('signs out locally and unsubscribes on unmount', async () => {
		mocks.getSession.mockResolvedValue({
			data: { session: session() },
			error: null,
		})
		const { unmount } = render(<AdminPortal />)
		await screen.findByText('Admin access verified')
		fireEvent.click(
			screen.getByRole('button', { name: 'Sign out on this device' }),
		)
		await screen.findByLabelText('Password')
		expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
		unmount()
		expect(mocks.unsubscribe).toHaveBeenCalled()
	})

	it('reports session restoration errors', async () => {
		mocks.getSession.mockRejectedValue(new Error('Connection failed'))
		render(<AdminPortal />)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Connection failed',
		)
	})
})
