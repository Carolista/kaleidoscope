import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LogoStar from './LogoStar'

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
})
