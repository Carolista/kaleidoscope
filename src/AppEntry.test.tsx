import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppEntry from './AppEntry'
import { useState, type ReactNode } from 'react'
import loadingStyles from './components/shared/Loading.module.css'
import entryStyles from './AppEntry.module.css'
import { NavigationGuardDialog, useUnsavedDraft } from '@/ui/navigation'

vi.mock('./App', () => ({ default: () => <p>Player app</p> }))
vi.mock('./state/AppContext', () => ({
	AppStateProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('./components/admin/AdminPortal', () => ({
	default: function MockAdmin() {
		const [dirty, setDirty] = useState(false)
		const [pending, setPending] = useState(false)
		useUnsavedDraft({ dirty, pending })
		return (
			<>
				<a href="#">Home</a>
				<button onClick={() => setDirty(true)}>Edit draft</button>
				<button onClick={() => setPending(true)}>Start write</button>
				<NavigationGuardDialog />
			</>
		)
	},
}))

beforeEach(() => window.history.replaceState(null, '', '/#/admin'))
afterEach(() => {
	vi.restoreAllMocks()
	window.history.replaceState(null, '', '/')
})

function leaveAdmin() {
	const oldURL = window.location.href
	window.history.replaceState(null, '', '/#')
	window.dispatchEvent(
		new HashChangeEvent('hashchange', {
			oldURL,
			newURL: window.location.href,
		}),
	)
}

describe('admin navigation', () => {
	it('styles the lazy admin fallback before loading the admin workspace', async () => {
		render(<AppEntry />)
		const loading = screen.getByRole('status')
		expect(loading).toHaveTextContent('Loading admin sign-in…')
		expect(loading).toHaveClass(
			loadingStyles.section,
			entryStyles.adminLoading,
		)
		await screen.findByRole('button', { name: 'Edit draft' })
	})

	it('guards Home before changing the URL and leaves only after confirmation', async () => {
		render(<AppEntry />)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Edit draft' }),
		)
		const length = window.history.length
		fireEvent.click(screen.getByRole('link', { name: 'Home' }))
		expect(window.location.hash).toBe('#/admin')
		expect(window.history.length).toBe(length)
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		expect(window.location.hash).toBe('#/admin')
		fireEvent.click(screen.getByRole('link', { name: 'Home' }))
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		expect(screen.getByText('Player app')).toBeInTheDocument()
		expect(window.history.length).toBe(length + 1)
		const unload = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(unload)
		expect(unload.defaultPrevented).toBe(false)
	})

	it('restores the admin URL during a pending write without offering to discard it', async () => {
		render(<AppEntry />)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Start write' }),
		)
		act(leaveAdmin)
		expect(window.location.hash).toBe('#/admin')
		expect(
			screen.getByRole('dialog', { name: 'Operation in progress' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Discard changes' }),
		).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Stay here' }))
		expect(
			screen.getByRole('button', { name: 'Start write' }),
		).toBeInTheDocument()
		expect(window.location.hash).toBe('#/admin')
	})

	it.each([-1, 1])(
		'restores a blocked history traversal (%s) without rewriting its destination',
		async index => {
			const go = vi
				.spyOn(window.history, 'go')
				.mockImplementation(() => {})
			render(<AppEntry />)
			fireEvent.click(
				await screen.findByRole('button', { name: 'Edit draft' }),
			)
			const adminState = window.history.state
			act(() => {
				window.history.replaceState(
					{ kaleidoscopeRouteIndex: index, otherState: 'preserved' },
					'',
					'/#destination',
				)
				window.dispatchEvent(new PopStateEvent('popstate'))
				window.dispatchEvent(new HashChangeEvent('hashchange'))
			})
			expect(go).toHaveBeenCalledExactlyOnceWith(-index)
			expect(
				screen.getByRole('dialog', {
					name: 'Discard unsaved changes?',
				}),
			).toBeInTheDocument()
			act(() => {
				window.history.replaceState(adminState, '', '/#/admin')
				window.dispatchEvent(new PopStateEvent('popstate'))
			})
			fireEvent.click(
				screen.getByRole('button', { name: 'Discard changes' }),
			)
			expect(go).toHaveBeenLastCalledWith(index)
			expect(go).toHaveBeenCalledTimes(2)
			act(() => {
				window.history.replaceState(
					{ kaleidoscopeRouteIndex: index, otherState: 'preserved' },
					'',
					'/#destination',
				)
				window.dispatchEvent(new PopStateEvent('popstate'))
				window.dispatchEvent(new HashChangeEvent('hashchange'))
			})
			expect(screen.getByText('Player app')).toBeInTheDocument()
			expect(window.history.state.otherState).toBe('preserved')
		},
	)

	it('keeps the first hash destination and restores the URL on repeated attempts', async () => {
		render(<AppEntry />)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Edit draft' }),
		)
		act(leaveAdmin)
		act(() => {
			window.history.replaceState(null, '', '/#second')
			window.dispatchEvent(new HashChangeEvent('hashchange'))
		})
		expect(window.location.hash).toBe('#/admin')
		expect(screen.getAllByRole('dialog')).toHaveLength(1)
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		expect(window.location.hash).not.toBe('#second')
		expect(screen.getByText('Player app')).toBeInTheDocument()
	})

	it('guards hash navigation, including browser history changes, when a draft is dirty', async () => {
		render(<AppEntry />)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Edit draft' }),
		)
		act(leaveAdmin)
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		expect(window.location.hash).toBe('#/admin')
		expect(
			screen.getByRole('button', { name: 'Edit draft' }),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		act(leaveAdmin)
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		expect(screen.getByText('Player app')).toBeInTheDocument()
	})

	it('leaves a clean workspace without confirmation', async () => {
		render(<AppEntry />)
		await screen.findByRole('button', { name: 'Edit draft' })
		const confirm = vi.spyOn(window, 'confirm')
		act(leaveAdmin)
		expect(confirm).not.toHaveBeenCalled()
		expect(screen.getByText('Player app')).toBeInTheDocument()
	})
})
