import { act, render, screen } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppEntry from './AppEntry'

const account = vi.hoisted(() => ({ status: 'signedOut' as string }))

vi.mock('./PlayerApp', () => ({ default: () => <p>Player app</p> }))
vi.mock('./BetaApp', () => ({ default: () => <p>Beta app</p> }))
vi.mock('@/features/account', () => ({
	AccountProvider: ({ children }: { children: ReactNode }) => children,
	useAccount: () => ({ status: account.status, userId: 'user-1' }),
}))
vi.mock('@/ui/content/PlayerContentProvider', () => ({
	PlayerContentProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@/features/zen/state/ZenStateProvider', () => ({
	ZenStateProvider: ({ children }: { children: ReactNode }) => children,
}))

const token = `b${'a1'.repeat(32)}`

function goTo(hash: string) {
	act(() => {
		window.history.pushState(null, '', `/${hash}`)
		window.dispatchEvent(new HashChangeEvent('hashchange'))
	})
}

beforeEach(() => {
	account.status = 'signedOut'
	localStorage.clear()
	window.history.replaceState(null, '', '/')
})
afterEach(() => window.history.replaceState(null, '', '/'))

describe('the beta route', () => {
	it('shows the beta page at #/beta, with or without an invite, and the player app elsewhere', () => {
		window.history.replaceState(null, '', '/#/beta')
		render(<AppEntry />)
		expect(screen.getByText('Beta app')).toBeInTheDocument()
		goTo('#/beta?invite=abc')
		expect(screen.getByText('Beta app')).toBeInTheDocument()
		goTo('#/betamax')
		expect(screen.getByText('Player app')).toBeInTheDocument()
		goTo('#/beta')
		expect(screen.getByText('Beta app')).toBeInTheDocument()
		goTo('')
		expect(screen.getByText('Player app')).toBeInTheDocument()
	})

	it('sends a signed-in player who left an invite link to the beta page', async () => {
		localStorage.setItem(
			'kaleidoscope:beta-invite',
			JSON.stringify({ token, at: Date.now() }),
		)
		account.status = 'signedIn'
		render(<AppEntry />)
		expect(window.location.hash).toBe('#/beta')
		expect(await screen.findByText('Beta app')).toBeInTheDocument()
	})

	it('still follows the invite when effects run twice, as in development', async () => {
		localStorage.setItem(
			'kaleidoscope:beta-invite',
			JSON.stringify({ token, at: Date.now() }),
		)
		account.status = 'signedIn'
		render(
			<StrictMode>
				<AppEntry />
			</StrictMode>,
		)
		expect(await screen.findByText('Beta app')).toBeInTheDocument()
	})

	it('leaves a player alone when there is no invite, or when they are not signed in', () => {
		account.status = 'signedIn'
		const { unmount } = render(<AppEntry />)
		expect(window.location.hash).toBe('')
		unmount()
		localStorage.setItem(
			'kaleidoscope:beta-invite',
			JSON.stringify({ token, at: Date.now() }),
		)
		account.status = 'signedOut'
		render(<AppEntry />)
		expect(window.location.hash).toBe('')
		expect(screen.getByText('Player app')).toBeInTheDocument()
	})
})
