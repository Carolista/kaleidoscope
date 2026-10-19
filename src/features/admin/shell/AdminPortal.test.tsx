import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
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
vi.mock('@/features/admin/services/puzzleLibrary', () => ({
	loadPuzzleDrafts: async () => [],
}))
vi.mock('@/features/admin/services/puzzleSets', () => ({
	loadDraftSets: async () => [],
	manageDraftSet: vi.fn(),
	deleteDraftSet: vi.fn(),
}))
vi.mock('@/features/admin/services/paletteSets', () => ({
	loadPaletteSets: async () => [],
	managePaletteSet: vi.fn(),
	paletteSetLabels: {
		undecided: 'Undecided',
		core: 'Core',
		reward: 'Reward',
		paid: 'Pack',
	},
}))
vi.mock('@/lib/supabase/supabaseClient', () => ({
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

async function openPaletteCatalog() {
	fireEvent.click(
		within(
			await screen.findByRole('navigation', { name: 'Admin sections' }),
		).getByRole('button', { name: 'Palettes' }),
	)
	fireEvent.click(
		within(
			screen.getByRole('navigation', { name: 'Palettes views' }),
		).getByRole('button', { name: 'Palettes' }),
	)
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
					select: () => ({
						order: () => ({ range: mocks.palettes }),
					}),
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
	it.each(['returned', 'thrown'])(
		'retains unsaved work after a %s sign-out error and protects pending sign-out',
		async mode => {
			mocks.getSession.mockResolvedValue({
				data: { session: session() },
				error: null,
			})
			let finish!: () => void
			mocks.signOut.mockImplementationOnce(
				() =>
					new Promise((resolve, reject) => {
						finish = () => {
							if (mode === 'thrown')
								reject(new Error('Sign-out unavailable'))
							else
								resolve({
									error: { message: 'Sign-out unavailable' },
								})
						}
					}),
			)
			render(<AdminPortal />)
			await openPaletteCatalog()
			fireEvent.click(
				await screen.findByRole('button', { name: 'New palette' }),
			)
			fireEvent.change(screen.getByLabelText('Palette name'), {
				target: { value: 'Keep my palette' },
			})
			const sandbox = screen.getByRole('img', {
				name: 'Palette sandbox design',
			}).innerHTML
			const signOut = screen.getByRole('button', {
				name: 'Sign out on this device',
			})
			fireEvent.click(signOut)
			fireEvent.click(
				screen.getByRole('button', { name: 'Discard changes' }),
			)
			fireEvent.click(signOut)
			expect(mocks.signOut).toHaveBeenCalledOnce()
			expect(
				screen.getByLabelText('Palette name').closest('[inert]'),
			).not.toBeNull()
			const unload = new Event('beforeunload', { cancelable: true })
			window.dispatchEvent(unload)
			expect(unload.defaultPrevented).toBe(true)
			await act(async () => finish())
			expect(screen.getByRole('alert')).toHaveTextContent(
				'Sign-out unavailable',
			)
			expect(screen.getByLabelText('Palette name')).toHaveValue(
				'Keep my palette',
			)
			expect(
				screen.getByLabelText('Palette name').closest('[inert]'),
			).toBeNull()
			expect(
				screen.getByRole('img', { name: 'Palette sandbox design' })
					.innerHTML,
			).toBe(sandbox)
			fireEvent.click(
				screen.getByRole('button', { name: 'Sign out on this device' }),
			)
			expect(
				screen.getByRole('dialog', {
					name: 'Discard unsaved changes?',
				}),
			).toBeInTheDocument()
			fireEvent.click(
				screen.getByRole('button', { name: 'Discard changes' }),
			)
			await screen.findByRole('button', { name: 'Sign in' })
			expect(mocks.signOut).toHaveBeenCalledTimes(2)
		},
	)

	it('shows shared pending feedback during session restoration and failed sign-in', async () => {
		let finishSession!: (value: {
			data: { session: null }
			error: null
		}) => void
		mocks.getSession.mockReturnValue(
			new Promise(resolve => {
				finishSession = resolve
			}),
		)
		render(<AdminPortal />)
		const restoring = screen.getByRole('status')
		expect(restoring).toHaveTextContent('Restoring session…')
		expect(restoring.querySelector('img')).toHaveAttribute(
			'aria-hidden',
			'true',
		)
		await act(async () => {
			finishSession({ data: { session: null }, error: null })
		})
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		let failSignIn!: (cause: Error) => void
		mocks.signInWithPassword.mockReturnValue(
			new Promise((_resolve, reject) => {
				failSignIn = reject
			}),
		)
		fireEvent.change(screen.getByLabelText('Email'), {
			target: { value: 'admin@example.com' },
		})
		fireEvent.change(screen.getByLabelText('Password'), {
			target: { value: 'test-only' },
		})
		fireEvent.submit(
			screen.getByRole('button', { name: 'Sign in' }).closest('form')!,
		)
		expect(screen.getByRole('status')).toHaveTextContent('Signing in…')
		expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
		await act(async () => {
			failSignIn(new Error('Offline'))
		})
		expect(screen.getByRole('alert')).toHaveTextContent('Offline')
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
	})

	it('guards sign-out with unsaved palette edits and keeps the sandbox stable on theme changes', async () => {
		mocks.getSession.mockResolvedValue({
			data: { session: session() },
			error: null,
		})
		render(<AdminPortal />)
		await openPaletteCatalog()
		fireEvent.click(
			await screen.findByRole('button', { name: 'New palette' }),
		)
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: 'Unsaved palette' },
		})
		const preview = screen.getByRole('img', {
			name: 'Palette sandbox design',
		}).innerHTML
		fireEvent.click(
			screen.getByRole('button', { name: 'Switch to light mode' }),
		)
		expect(
			screen.getByRole('img', { name: 'Palette sandbox design' })
				.innerHTML,
		).toBe(preview)
		fireEvent.click(
			screen.getByRole('button', { name: 'Sign out on this device' }),
		)
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		expect(mocks.signOut).not.toHaveBeenCalled()
		expect(screen.getByLabelText('Palette name')).toHaveValue(
			'Unsaved palette',
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Sign out on this device' }),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		await screen.findByRole('button', { name: 'Sign in' })
	})

	it('defaults to dark mode and toggles the admin theme without changing player state', () => {
		const write = vi.spyOn(Storage.prototype, 'setItem')
		render(<AdminPortal />)
		const page = screen.getByRole('main')
		expect(page).toHaveAttribute('data-theme', 'dark')
		expect(page.style.getPropertyValue('--base')).toBe('#222222')
		expect(page.style.getPropertyValue('--accent')).toBe('#ffffff')
		expect(document.documentElement.style.backgroundColor).toBe(
			'rgb(34, 34, 34)',
		)
		expect(document.body.style.backgroundColor).toBe('rgb(34, 34, 34)')
		const toggle = screen.getByRole('button', {
			name: 'Switch to light mode',
		})
		expect(toggle).toHaveAttribute('title', 'Switch to light mode')
		expect(toggle.querySelector('svg')).toHaveAttribute(
			'data-prefix',
			'fas',
		)
		fireEvent.click(toggle)
		expect(page).toHaveAttribute('data-theme', 'light')
		expect(page.style.getPropertyValue('--base')).toBe('#ffffff')
		expect(page.style.getPropertyValue('--accent')).toBe('#222222')
		expect(document.documentElement.style.backgroundColor).toBe(
			'rgb(255, 255, 255)',
		)
		expect(document.body.style.backgroundColor).toBe('rgb(255, 255, 255)')
		fireEvent.click(
			screen.getByRole('button', { name: 'Switch to dark mode' }),
		)
		expect(page).toHaveAttribute('data-theme', 'dark')
		expect(page.style.getPropertyValue('--base')).toBe('#222222')
		expect(document.body.style.backgroundColor).toBe('rgb(34, 34, 34)')
		expect(write).not.toHaveBeenCalled()
	})

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
			within(
				await screen.findByRole('navigation', {
					name: 'Puzzles views',
				}),
			).getByRole('button', { name: 'Puzzles' }),
		)
		fireEvent.click(
			await screen.findByRole('button', { name: 'New puzzle' }),
		)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Randomize puzzle' }),
		)
		await screen.findByLabelText('Puzzle name')
		fireEvent.click(
			screen.getByRole('button', { name: 'Sign out on this device' }),
		)
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		expect(mocks.signOut).not.toHaveBeenCalled()
		expect(screen.getByLabelText('Puzzle name')).toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('button', { name: 'Sign out on this device' }),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
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
				name: 'Draft sets',
			}),
		).toBeInTheDocument()
		expect(mocks.from).toHaveBeenCalledWith('admin_account')
		const signOut = screen.getByRole('button', {
			name: 'Sign out on this device',
		})
		const header = screen
			.getByRole('heading', { name: 'Kaleidoscope Admin' })
			.closest('header')
		expect(header).toContainElement(signOut)
		const toggle = screen.getByRole('button', {
			name: 'Switch to light mode',
		})
		expect(toggle.parentElement).toBe(signOut.parentElement)
		expect(signOut.parentElement).toContainElement(
			screen.getByText('admin@example.com'),
		)
		const home = screen.getByRole('link', { name: 'Back to Kaleidoscope' })
		expect(header).toContainElement(home)
		expect(home).toHaveAttribute('href', '#')
		expect(home).toHaveAttribute('title', 'Back to Kaleidoscope')
		expect(home.querySelector('img')).toHaveAttribute(
			'src',
			`${import.meta.env.BASE_URL}favicon.svg`,
		)
		expect(home.querySelector('img')).toHaveAttribute('alt', '')
		expect(home).not.toHaveTextContent('Back to Kaleidoscope')
		expect(signOut.querySelector('svg')).toHaveAttribute(
			'data-icon',
			'right-from-bracket',
		)
		expect(
			screen.queryByText('Admin access verified'),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Refresh palettes' }),
		).not.toBeInTheDocument()
		const lab = await screen.findByRole('heading', {
			name: 'Draft sets',
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
			screen.queryByRole('heading', { name: 'Draft sets' }),
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
			screen.queryByRole('heading', { name: 'Draft sets' }),
		).not.toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('button', { name: 'Retry access check' }),
		)
		expect(
			await screen.findByRole('heading', { name: 'Draft sets' }),
		).toBeInTheDocument()
	})

	it('removes admin content immediately when the account changes', async () => {
		mocks.getSession.mockResolvedValue({
			data: { session: session() },
			error: null,
		})
		render(<AdminPortal />)
		await screen.findByRole('heading', { name: 'Draft sets' })
		mocks.maybeSingle.mockImplementation(() => new Promise(() => {}))
		act(() => authCallback('SIGNED_IN', session('player')))
		expect(
			screen.queryByRole('heading', { name: 'Draft sets' }),
		).not.toBeInTheDocument()
		expect(screen.getByRole('status')).toHaveTextContent(
			'Checking admin access',
		)
		expect(screen.getByRole('status').querySelector('img')).toHaveAttribute(
			'aria-hidden',
			'true',
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
			screen.queryByRole('heading', { name: 'Draft sets' }),
		).not.toBeInTheDocument()
		expect(screen.getByLabelText('Password')).toBeInTheDocument()
	})

	it('signs out locally and unsubscribes on unmount', async () => {
		mocks.getSession.mockResolvedValue({
			data: { session: session() },
			error: null,
		})
		const { unmount } = render(<AdminPortal />)
		await screen.findByRole('heading', { name: 'Draft sets' })
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
