import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Spinner from './Spinner'
import starStyles from './LogoStar.module.css'
import styles from './Spinner.module.css'

describe('Spinner', () => {
	it('renders a decorative star with the pulse animation', () => {
		render(<Spinner />)
		const star = screen.getByRole('presentation', { hidden: true })
		expect(star).toHaveClass(starStyles.pulse, styles.spinner)
		expect(star).toHaveAttribute('aria-hidden', 'true')
	})
})
