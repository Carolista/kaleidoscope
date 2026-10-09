import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import GridShapeIcon from './GridShapeIcon'
import type { GridShapeId } from '../../types/gridShape'

// Expected piece count for each shape's preview, matching the
// un-subdivided version of its real grid-generation code: a hexagon of
// 7 hexagons, a triangle of 4 triangles, a diamond star of 6 diamonds,
// a hexagram of 12 triangles.
const EXPECTED_PIECE_COUNTS: Record<GridShapeId, number> = {
	hexagon: 7,
	triangle: 4,
	diamondStar: 6,
	hexagram: 12,
}

describe('GridShapeIcon', () => {
	it.each(Object.entries(EXPECTED_PIECE_COUNTS) as [GridShapeId, number][])(
		'renders %s as %i pieces, hidden from assistive tech',
		(shape, pieceCount) => {
			const { container } = render(<GridShapeIcon shape={shape} />)
			const svg = container.querySelector('svg')
			expect(svg).toHaveAttribute('aria-hidden', 'true')
			expect(container.querySelectorAll('polygon')).toHaveLength(
				pieceCount,
			)
		},
	)

	it('gives every piece a non-empty points attribute', () => {
		const { container } = render(<GridShapeIcon shape="hexagram" />)
		for (const polygon of container.querySelectorAll('polygon')) {
			expect(polygon.getAttribute('points')).toMatch(/\d/)
		}
	})
})
