import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ZenStateProvider } from '@/features/zen/state'
import {
	PINWHEEL_GRID_SIZES,
	computeGridAspectRatio,
	getGroupIds,
} from '@/domain/shapes/pinwheel'
import PinwheelGrid from './PinwheelGrid'

describe('PinwheelGrid', () => {
	it('exposes exactly 12 clickable tiles, each as an accessible, labeled button', () => {
		render(<PinwheelGrid />, { wrapper: ZenStateProvider })
		const tiles = screen.getAllByRole('button')
		expect(tiles).toHaveLength(12)
		expect(tiles[0]).toHaveAccessibleName('Paint tile 1 of 12')
		expect(tiles[11]).toHaveAccessibleName('Paint tile 12 of 12')
	})

	it('paints a tile on click and announces it via the live region', async () => {
		const user = userEvent.setup()
		render(<PinwheelGrid />, { wrapper: ZenStateProvider })

		const tile = screen.getByRole('button', {
			name: 'Paint tile 1 of 12',
		})
		const fillBefore = tile.getAttribute('fill')

		await user.click(tile)

		expect(tile.getAttribute('fill')).not.toBe(fillBefore)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Painted tile 1 of 12.',
		)
	})

	it('paints a tile via the keyboard (Enter and Space), not just click', async () => {
		const user = userEvent.setup()
		render(<PinwheelGrid />, { wrapper: ZenStateProvider })

		const tile = screen.getByRole('button', {
			name: 'Paint tile 2 of 12',
		})
		tile.focus()
		const fillBefore = tile.getAttribute('fill')

		await user.keyboard('{Enter}')
		const fillAfterEnter = tile.getAttribute('fill')
		expect(fillAfterEnter).not.toBe(fillBefore)

		await user.keyboard(' ')
		expect(tile.getAttribute('fill')).not.toBe(fillAfterEnter)
	})

	it.each(Object.entries(PINWHEEL_GRID_SIZES))(
		'renders the %s grid at %s row and %s column steps',
		(_size, { rowSteps, colSteps }) => {
			render(<PinwheelGrid rowSteps={rowSteps} colSteps={colSteps} />, {
				wrapper: ZenStateProvider,
			})
			const grid = screen.getByRole('group', {
				name: 'Kaleidoscope pinwheel grid',
			})
			expect(grid.querySelectorAll('polygon')).toHaveLength(
				8 * rowSteps * colSteps,
			)
			expect(grid.querySelectorAll('[role="button"]')).toHaveLength(
				getGroupIds(rowSteps, colSteps).length,
			)
			expect(grid).toHaveStyle({
				'--grid-aspect-ratio': String(
					computeGridAspectRatio(rowSteps, colSteps),
				),
			})
		},
	)
})
