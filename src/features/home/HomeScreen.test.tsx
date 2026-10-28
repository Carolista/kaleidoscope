import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestZenStateProvider } from '@/test/TestZenStateProvider'
import HomeScreen from './HomeScreen'

function renderHome(props: Partial<Parameters<typeof HomeScreen>[0]> = {}) {
	const handlers = { onOpenPuzzle: vi.fn(), onOpenZen: vi.fn() }
	render(<HomeScreen signedIn={false} {...handlers} {...props} />, {
		wrapper: TestZenStateProvider,
	})
	return handlers
}

describe('HomeScreen', () => {
	it('offers Puzzle then Zen, each with its tagline', async () => {
		const user = userEvent.setup()
		const { onOpenPuzzle, onOpenZen } = renderHome()
		const puzzle = screen.getByRole('button', { name: 'Puzzle Mode' })
		const zen = screen.getByRole('button', { name: 'Zen Mode' })
		expect(puzzle).toHaveAccessibleDescription(
			'Engage your mind with beautiful geometric puzzles.',
		)
		expect(zen).toHaveAccessibleDescription(
			'Relax and create colorful kaleidoscopes.',
		)
		expect(
			puzzle.compareDocumentPosition(zen) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		await user.click(puzzle)
		expect(onOpenPuzzle).toHaveBeenCalledOnce()
		await user.click(zen)
		expect(onOpenZen).toHaveBeenCalledOnce()
	})

	it('offers Continue on the Puzzle card when a puzzle was left unfinished', async () => {
		const user = userEvent.setup()
		const { onOpenPuzzle } = renderHome({ continuePuzzle: true })
		const card = screen.getByRole('button', { name: 'Continue' })
		expect(card).toHaveAccessibleDescription(
			'Pick up the puzzle you left unfinished.',
		)
		expect(
			screen.queryByRole('button', { name: 'Puzzle' }),
		).not.toBeInTheDocument()
		await user.click(card)
		expect(onOpenPuzzle).toHaveBeenCalledOnce()
	})

	it('welcomes a guest and offers to sign in', async () => {
		const user = userEvent.setup()
		const onSignIn = vi.fn()
		renderHome({ onSignIn })
		expect(
			screen.getByRole('heading', { name: 'Welcome!' }),
		).toBeInTheDocument()
		await user.click(
			screen.getByRole('button', {
				name: 'Sign in or create an account',
			}),
		)
		expect(onSignIn).toHaveBeenCalledOnce()
	})

	it('does not offer sign-in where accounts are unavailable', () => {
		renderHome()
		expect(
			screen.queryByRole('button', {
				name: 'Sign in or create an account',
			}),
		).not.toBeInTheDocument()
	})

	it('greets a signed-in player by first name, with no sign-in link', () => {
		renderHome({ signedIn: true, firstName: 'Ada', onSignIn: vi.fn() })
		expect(
			screen.getByRole('heading', { name: 'Hi, Ada!' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', {
				name: 'Sign in or create an account',
			}),
		).not.toBeInTheDocument()
	})

	it('greets a signed-in player without a name generically', () => {
		renderHome({ signedIn: true })
		expect(
			screen.getByRole('heading', { name: 'Welcome back!' }),
		).toBeInTheDocument()
	})
})
