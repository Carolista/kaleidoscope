import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import Header from './Header'

describe('Header', () => {
	it('uses solid icons with accessible mode names and preserves switching', async () => {
		const onModeChange = vi.fn()
		render(<Header mode="zen" onModeChange={onModeChange} />)
		const zen = screen.getByRole('button', { name: 'Zen Mode' })
		const puzzle = screen.getByRole('button', { name: 'Puzzle Mode' })
		expect(zen).toHaveAttribute('aria-pressed', 'true')
		expect(puzzle).toHaveAttribute('aria-pressed', 'false')
		expect(zen).toHaveAttribute('title', 'Zen Mode')
		// Only the active mode shows its name beside the icon.
		expect(zen).toHaveTextContent('ZEN')
		expect(puzzle).toHaveTextContent('')
		expect(screen.getByText('ZEN')).toHaveAttribute('aria-hidden', 'true')
		expect(zen.querySelector('svg')).toHaveAttribute('data-icon', 'spa')
		expect(puzzle.querySelector('svg')).toHaveAttribute(
			'data-icon',
			'puzzle-piece-simple',
		)
		for (const button of [zen, puzzle]) {
			expect(button.querySelector('svg')).toHaveAttribute(
				'data-prefix',
				'fas',
			)
		}
		await userEvent.setup().click(puzzle)
		expect(onModeChange).toHaveBeenCalledWith('puzzle')
	})

	it('labels the puzzle button instead when Puzzle Mode is active', () => {
		render(<Header mode="puzzle" onModeChange={vi.fn()} />)
		expect(
			screen.getByRole('button', { name: 'Puzzle Mode' }),
		).toHaveTextContent('PUZZLE')
		expect(
			screen.getByRole('button', { name: 'Zen Mode' }),
		).toHaveTextContent('')
	})

	it('shows page-wide actions before the mode switch', () => {
		render(
			<Header
				mode="zen"
				onModeChange={vi.fn()}
				actions={<button type="button">Action</button>}
			/>,
		)
		const mode = screen.getByRole('navigation', { name: 'Play mode' })
		expect(
			mode.compareDocumentPosition(
				screen.getByRole('button', { name: 'Action' }),
			) & Node.DOCUMENT_POSITION_PRECEDING,
		).toBeTruthy()
	})

	it('combines live lettering and a decorative star in one accessible heading', () => {
		render(<Header />)
		const heading = screen.getByRole('heading', {
			level: 1,
			name: 'Kaleidoscope',
		})
		expect(heading).toHaveTextContent('KALEIDSCOPE')
		const star = heading.querySelector('img')
		expect(star).toHaveAttribute('aria-hidden', 'true')
		expect(star).toHaveAttribute('alt', '')
		expect(star).toHaveAttribute(
			'src',
			`${import.meta.env.BASE_URL}favicon.svg`,
		)
	})
})
