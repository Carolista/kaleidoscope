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
		expect(zen).toHaveTextContent('')
		expect(zen.querySelector('svg')).toHaveAttribute(
			'data-icon',
			'paintbrush',
		)
		expect(puzzle.querySelector('svg')).toHaveAttribute(
			'data-icon',
			'puzzle-piece',
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

	it('shows page-wide actions after the mode switch', () => {
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
			) & Node.DOCUMENT_POSITION_FOLLOWING,
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
