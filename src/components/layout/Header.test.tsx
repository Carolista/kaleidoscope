import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Header from './Header'

describe('Header', () => {
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
