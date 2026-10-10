import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '@state/AppContext'
import PinwheelGrid from './PinwheelGrid'

describe('PinwheelGrid', () => {
	it('exposes exactly 9 clickable tiles, each as an accessible, labeled button', () => {
		render(<PinwheelGrid />, { wrapper: AppStateProvider })
		const tiles = screen.getAllByRole('button')
		expect(tiles).toHaveLength(9)
		expect(tiles[0]).toHaveAccessibleName('Paint tile 1 of 9')
		expect(tiles[8]).toHaveAccessibleName('Paint tile 9 of 9')
	})

	it('paints a tile on click and announces it via the live region', async () => {
		const user = userEvent.setup()
		render(<PinwheelGrid />, { wrapper: AppStateProvider })

		const tile = screen.getByRole('button', {
			name: 'Paint tile 1 of 9',
		})
		const fillBefore = tile.getAttribute('fill')

		await user.click(tile)

		expect(tile.getAttribute('fill')).not.toBe(fillBefore)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Painted tile 1 of 9.',
		)
	})

	it('paints a tile via the keyboard (Enter and Space), not just click', async () => {
		const user = userEvent.setup()
		render(<PinwheelGrid />, { wrapper: AppStateProvider })

		const tile = screen.getByRole('button', {
			name: 'Paint tile 2 of 9',
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
