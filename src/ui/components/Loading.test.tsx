import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Loading from './Loading'
import styles from './Loading.module.css'
import starStyles from './LogoStar.module.css'

describe('Loading', () => {
	it('provides one readable live status and a decorative star without player state', () => {
		render(<Loading label="Loading palettes…" />)
		const status = screen.getByRole('status')
		expect(status).toHaveTextContent('Loading palettes…')
		expect(status).toHaveClass(styles.loading, styles.compact)
		expect(within(status).queryByRole('status')).not.toBeInTheDocument()
		const star = within(status).getByRole('presentation', { hidden: true })
		expect(star).toHaveAttribute('aria-hidden', 'true')
		expect(star).toHaveAttribute('alt', '')
		expect(star).toHaveClass(starStyles.pulse)
	})

	it('supports section placement and updates labels without replacing the status', () => {
		const { rerender } = render(
			<Loading
				label="Loading catalog…"
				variant="section"
				className="placement"
			/>,
		)
		const status = screen.getByRole('status')
		expect(status).toHaveClass(styles.section, 'placement')
		rerender(<Loading label="Refreshing catalog…" variant="section" />)
		expect(screen.getByRole('status')).toBe(status)
		expect(status).toHaveTextContent('Refreshing catalog…')
	})
})
