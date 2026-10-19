import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppEntry from './AppEntry'
import type { ReactNode } from 'react'
import loadingStyles from './components/shared/Loading.module.css'
import entryStyles from './AppEntry.module.css'

vi.mock('./App', () => ({ default: () => <p>Player app</p> }))
vi.mock('./state/AppContext', () => ({
	AppStateProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('./components/admin/AdminPortal', () => ({
	default: ({
		onDirtyChange,
	}: {
		onDirtyChange: (dirty: boolean) => void
	}) => <button onClick={() => onDirtyChange(true)}>Edit draft</button>,
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
	it('guards hash navigation, including browser history changes, when a draft is dirty', async () => {
		render(<AppEntry />)
		const loading = screen.getByRole('status')
		expect(loading).toHaveTextContent('Loading admin sign-in…')
		expect(loading).toHaveClass(
			loadingStyles.section,
			entryStyles.adminLoading,
		)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Edit draft' }),
		)
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
		act(leaveAdmin)
		expect(confirm).toHaveBeenCalledOnce()
		expect(window.location.hash).toBe('#/admin')
		expect(
			screen.getByRole('button', { name: 'Edit draft' }),
		).toBeInTheDocument()
		confirm.mockReturnValue(true)
		act(leaveAdmin)
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
