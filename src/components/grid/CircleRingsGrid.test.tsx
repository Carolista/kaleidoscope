import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '@state/AppContext'
import CircleRingsGrid from './CircleRingsGrid'

describe('CircleRingsGrid', () => {
	it('exposes exactly 16 clickable tiles, each as an accessible, labeled button', () => {
		render(<CircleRingsGrid />, { wrapper: AppStateProvider })
		const tiles = screen.getAllByRole('button')
		expect(tiles).toHaveLength(16)
		expect(tiles[0]).toHaveAccessibleName('Paint tile 1 of 16')
		expect(tiles[15]).toHaveAccessibleName('Paint tile 16 of 16')
	})

	it('paints a tile on click and announces it via the live region', async () => {
		const user = userEvent.setup()
		render(<CircleRingsGrid />, { wrapper: AppStateProvider })

		const tile = screen.getByRole('button', {
			name: 'Paint tile 1 of 16',
		})
		const fillBefore = tile.getAttribute('fill')

		await user.click(tile)

		expect(tile.getAttribute('fill')).not.toBe(fillBefore)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Painted tile 1 of 16.',
		)
	})

	it('paints a tile via the keyboard (Enter and Space), not just click', async () => {
		const user = userEvent.setup()
		render(<CircleRingsGrid />, { wrapper: AppStateProvider })

		const tile = screen.getByRole('button', {
			name: 'Paint tile 2 of 16',
		})
		tile.focus()
		const fillBefore = tile.getAttribute('fill')

		await user.keyboard('{Enter}')
		const fillAfterEnter = tile.getAttribute('fill')
		expect(fillAfterEnter).not.toBe(fillBefore)

		await user.keyboard(' ')
		expect(tile.getAttribute('fill')).not.toBe(fillAfterEnter)
	})

	it('renders every cell as a <circle>, never a <polygon>', () => {
		const { container } = render(<CircleRingsGrid />, {
			wrapper: AppStateProvider,
		})
		expect(container.querySelectorAll('circle').length).toBeGreaterThan(0)
		expect(container.querySelectorAll('polygon')).toHaveLength(0)
	})

	it('gives every circle a strictly positive radius, with the center dot tied for smallest (with ring 1) and the outermost ring strictly the largest', () => {
		const { container } = render(<CircleRingsGrid />, {
			wrapper: AppStateProvider,
		})
		const radii = [...container.querySelectorAll('circle')].map(circle =>
			Number(circle.getAttribute('r')),
		)
		for (const r of radii) {
			expect(r).toBeGreaterThan(0)
		}
		// The center dot (1 circle) and ring 1 (6 circles) share the
		// smallest, floor radius.
		const smallest = Math.min(...radii)
		expect(radii.filter(r => r === smallest)).toHaveLength(7)
		expect(smallest).toBeLessThan(Math.max(...radii))
	})
})
