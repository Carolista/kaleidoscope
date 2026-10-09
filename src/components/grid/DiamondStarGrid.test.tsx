import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '@state/AppContext'
import DiamondStarGrid from './DiamondStarGrid'

describe('DiamondStarGrid', () => {
	it('exposes exactly 10 clickable tiles, each as an accessible, labeled button', () => {
		render(<DiamondStarGrid />, { wrapper: AppStateProvider })
		const tiles = screen.getAllByRole('button')
		expect(tiles).toHaveLength(10)
		expect(tiles[0]).toHaveAccessibleName('Paint tile 1 of 10')
		expect(tiles[9]).toHaveAccessibleName('Paint tile 10 of 10')
	})

	it('paints a tile on click and announces it via the live region', async () => {
		const user = userEvent.setup()
		render(<DiamondStarGrid />, { wrapper: AppStateProvider })

		const tile = screen.getByRole('button', {
			name: 'Paint tile 1 of 10',
		})
		const fillBefore = tile.getAttribute('fill')

		await user.click(tile)

		expect(tile.getAttribute('fill')).not.toBe(fillBefore)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Painted tile 1 of 10.',
		)
	})

	it('paints a tile via the keyboard (Enter and Space), not just click', async () => {
		const user = userEvent.setup()
		render(<DiamondStarGrid />, { wrapper: AppStateProvider })

		const tile = screen.getByRole('button', {
			name: 'Paint tile 2 of 10',
		})
		tile.focus()
		const fillBefore = tile.getAttribute('fill')

		await user.keyboard('{Enter}')
		const fillAfterEnter = tile.getAttribute('fill')
		expect(fillAfterEnter).not.toBe(fillBefore)

		await user.keyboard(' ')
		expect(tile.getAttribute('fill')).not.toBe(fillAfterEnter)
	})
})
