import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TextCaseContext } from '@/ui/text'
import Heading from './Heading'

describe('Heading', () => {
	it('renders the requested level and keeps its attributes', () => {
		render(
			<Heading level={3} id="title" className="custom">
				puzzle sets
			</Heading>,
		)
		const heading = screen.getByRole('heading', { level: 3 })
		expect(heading).toHaveTextContent('puzzle sets')
		expect(heading).toHaveAttribute('id', 'title')
		expect(heading).toHaveClass('custom')
	})

	it('title-cases where the app opts in', () => {
		render(
			<TextCaseContext.Provider value="title">
				<Heading level={2}>your progress is on the way</Heading>
			</TextCaseContext.Provider>,
		)
		expect(
			screen.getByRole('heading', {
				name: 'Your Progress Is On the Way',
			}),
		).toBeInTheDocument()
	})
})
