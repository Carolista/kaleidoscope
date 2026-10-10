import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import GridShapeIcon from './GridShapeIcon'
import type { GridShapeId } from '@appTypes/gridShape'

// Expected piece count for each shape's preview, matching the
// un-subdivided version of its real grid-generation code: a hexagon of
// 7 hexagons, a triangle of 4 triangles, a diamond star of 6 diamonds,
// a hexagram of 12 triangles, a circle rings shape of 1 center dot + 6
// ring-1 circles, a pinwheel of 8 parallelograms (1 per spoke x 8
// spokes).
const EXPECTED_PIECE_COUNTS: Record<GridShapeId, number> = {
	hexagon: 7,
	triangle: 4,
	diamondStar: 6,
	hexagram: 12,
	circleRings: 7,
	pinwheel: 8,
}

describe('GridShapeIcon', () => {
	it.each(Object.entries(EXPECTED_PIECE_COUNTS) as [GridShapeId, number][])(
		'renders %s as %i pieces, hidden from assistive tech',
		(shape, pieceCount) => {
			const { container } = render(<GridShapeIcon shape={shape} />)
			const svg = container.querySelector('svg')
			expect(svg).toHaveAttribute('aria-hidden', 'true')
			const pieces = container.querySelectorAll('polygon, circle')
			expect(pieces).toHaveLength(pieceCount)
		},
	)

	it('gives every polygon piece a non-empty points attribute', () => {
		const { container } = render(<GridShapeIcon shape="hexagram" />)
		for (const polygon of container.querySelectorAll('polygon')) {
			expect(polygon.getAttribute('points')).toMatch(/\d/)
		}
	})

	it('gives every circle piece a positive radius', () => {
		const { container } = render(<GridShapeIcon shape="circleRings" />)
		for (const circle of container.querySelectorAll('circle')) {
			expect(Number(circle.getAttribute('r'))).toBeGreaterThan(0)
		}
	})
})
