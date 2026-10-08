import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '../state/AppContext'
import HexGrid from './HexGrid'

describe('HexGrid', () => {
	it('exposes exactly 30 clickable tiles, each as an accessible, labeled button', () => {
		render(<HexGrid />, { wrapper: AppStateProvider })
		const tiles = screen.getAllByRole('button')
		expect(tiles).toHaveLength(30)
		expect(tiles[0]).toHaveAccessibleName('Paint hex tile 1 of 30')
		expect(tiles[29]).toHaveAccessibleName('Paint hex tile 30 of 30')
	})

	it('paints a tile on click and announces it via the live region', async () => {
		const user = userEvent.setup()
		render(<HexGrid />, { wrapper: AppStateProvider })

		const tile = screen.getByRole('button', {
			name: 'Paint hex tile 1 of 30',
		})
		const fillBefore = tile.getAttribute('fill')

		await user.click(tile)

		expect(tile.getAttribute('fill')).not.toBe(fillBefore)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Painted hex tile 1 of 30.',
		)
	})

	it('paints a tile via the keyboard (Enter and Space), not just click', async () => {
		const user = userEvent.setup()
		render(<HexGrid />, { wrapper: AppStateProvider })

		const tile = screen.getByRole('button', {
			name: 'Paint hex tile 2 of 30',
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
