import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AccountProvider } from '@/features/account'
import { fakeClient } from '@/test/fakeAccountClient'
import BetaApp from './BetaApp'
import BetaTheme from './BetaTheme'

beforeEach(() => {
	localStorage.clear()
	document.documentElement.removeAttribute('style')
})

describe('BetaApp', () => {
	it('offers the game settings, so the mode can be switched on the beta page', async () => {
		render(
			<BetaTheme>
				<AccountProvider client={fakeClient().client}>
					<BetaApp />
				</AccountProvider>
			</BetaTheme>,
		)
		await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
		const dark = document.documentElement.style.backgroundColor
		await userEvent.click(
			await screen.findByRole('button', { name: 'Switch to Light Mode' }),
		)
		expect(
			screen.getByRole('button', { name: 'Switch to Dark Mode' }),
		).toBeInTheDocument()
		expect(document.documentElement.style.backgroundColor).not.toBe(dark)
	})
})
