import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import Header from './Header'

describe('Header', () => {
	it('shows the current mode with a solid icon and opens the mode picker', async () => {
		const onOpenModes = vi.fn()
		render(<Header mode="zen" onOpenModes={onOpenModes} />)
		const button = screen.getByRole('button', {
			name: 'Change mode, currently Zen',
		})
		expect(button).toHaveAttribute('title', 'Change mode')
		expect(button).toHaveAttribute('aria-haspopup', 'dialog')
		expect(button).toHaveTextContent('ZEN')
		expect(screen.getByText('ZEN')).toHaveAttribute('aria-hidden', 'true')
		const icon = button.querySelector('svg')
		expect(icon).toHaveAttribute('data-icon', 'spa')
		expect(icon).toHaveAttribute('data-prefix', 'fas')
		await userEvent.setup().click(button)
		expect(onOpenModes).toHaveBeenCalledOnce()
	})

	it.each([
		['home', 'Home', 'house'],
		['puzzle', 'Puzzle', 'puzzle-piece-simple'],
	] as const)('names %s mode', (mode, label, icon) => {
		render(<Header mode={mode} onOpenModes={vi.fn()} />)
		const button = screen.getByRole('button', {
			name: `Change mode, currently ${label}`,
		})
		expect(button).toHaveTextContent(label.toUpperCase())
		expect(button.querySelector('svg')).toHaveAttribute('data-icon', icon)
	})

	it('has no mode button without a way to open the picker', () => {
		render(<Header mode="zen" />)
		expect(
			screen.queryByRole('button', { name: /Change mode/ }),
		).not.toBeInTheDocument()
	})

	it('shows page-wide actions after the mode button', () => {
		render(
			<Header
				mode="zen"
				onOpenModes={vi.fn()}
				actions={<button type="button">Action</button>}
			/>,
		)
		const mode = screen.getByRole('button', { name: /Change mode/ })
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
