import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '@/features/zen/state'
import {
	TRIANGLE_GRID_SIZES,
	computeGridAspectRatio,
	getGroupIds,
} from '@/domain/shapes/triangle'
import TriangleGrid from './TriangleGrid'

describe('TriangleGrid', () => {
	it('exposes exactly 22 clickable tiles, each as an accessible, labeled button', () => {
		render(<TriangleGrid />, { wrapper: AppStateProvider })
		const tiles = screen.getAllByRole('button')
		expect(tiles).toHaveLength(22)
		expect(tiles[0]).toHaveAccessibleName('Paint tile 1 of 22')
		expect(tiles[21]).toHaveAccessibleName('Paint tile 22 of 22')
	})

	it('paints a tile on click and announces it via the live region', async () => {
		const user = userEvent.setup()
		render(<TriangleGrid />, { wrapper: AppStateProvider })

		const tile = screen.getByRole('button', {
			name: 'Paint tile 1 of 22',
		})
		const fillBefore = tile.getAttribute('fill')

		await user.click(tile)

		expect(tile.getAttribute('fill')).not.toBe(fillBefore)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Painted tile 1 of 22.',
		)
	})

	it('paints a tile via the keyboard (Enter and Space), not just click', async () => {
		const user = userEvent.setup()
		render(<TriangleGrid />, { wrapper: AppStateProvider })

		const tile = screen.getByRole('button', {
			name: 'Paint tile 2 of 22',
		})
		tile.focus()
		const fillBefore = tile.getAttribute('fill')

		await user.keyboard('{Enter}')
		const fillAfterEnter = tile.getAttribute('fill')
		expect(fillAfterEnter).not.toBe(fillBefore)

		await user.keyboard(' ')
		expect(tile.getAttribute('fill')).not.toBe(fillAfterEnter)
	})

	it.each(Object.entries(TRIANGLE_GRID_SIZES))(
		'renders the %s grid at size %s',
		(_size, gridSize) => {
			const { container } = render(<TriangleGrid gridSize={gridSize} />, {
				wrapper: AppStateProvider,
			})
			expect(container.querySelectorAll('polygon')).toHaveLength(
				gridSize * gridSize,
			)
			expect(screen.getAllByRole('button')).toHaveLength(
				getGroupIds(gridSize).length,
			)
			expect(
				screen.getByRole('group', {
					name: 'Kaleidoscope triangle grid',
				}),
			).toHaveStyle({
				'--grid-aspect-ratio': String(computeGridAspectRatio(gridSize)),
			})
		},
	)
})
