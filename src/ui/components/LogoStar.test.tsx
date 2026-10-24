import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LogoStar from './LogoStar'
import styles from './LogoStar.module.css'

describe('LogoStar', () => {
	it('renders the favicon as a decorative image', () => {
		render(<LogoStar />)
		expect(
			screen.getByRole('presentation', { hidden: true }),
		).toHaveAttribute('src', `${import.meta.env.BASE_URL}favicon.svg`)
		expect(
			screen.getByRole('presentation', { hidden: true }),
		).toHaveAttribute('alt', '')
	})

	it('joins an arrival spin already under way when told how far along it is', () => {
		const { rerender } = render(<LogoStar />)
		const star = screen.getByRole('presentation', { hidden: true })
		expect(star.style.animationDelay).toBe('')
		rerender(<LogoStar elapsedMs={750.4} />)
		expect(star.style.animationDelay).toBe('-750ms')
	})

	it('preserves the default entrance and reports when it finishes', () => {
		const onSpinComplete = vi.fn()
		render(
			<LogoStar className="headerStar" onSpinComplete={onSpinComplete} />,
		)
		const star = screen.getByRole('presentation', { hidden: true })
		expect(star).toHaveClass(styles.star, styles.arrive, 'headerStar')
		fireEvent.animationEnd(star)
		expect(onSpinComplete).toHaveBeenCalledOnce()
	})

	it('switches to the looping pulse without reporting entrance completion', () => {
		const onSpinComplete = vi.fn()
		const { rerender } = render(
			<LogoStar onSpinComplete={onSpinComplete} />,
		)
		rerender(<LogoStar animation="pulse" onSpinComplete={onSpinComplete} />)
		const star = screen.getByRole('presentation', { hidden: true })
		expect(star).toHaveClass(styles.pulse)
		expect(star).not.toHaveClass(styles.arrive)
		fireEvent.animationEnd(star)
		expect(onSpinComplete).not.toHaveBeenCalled()
	})
})
