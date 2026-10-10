import { describe, expect, it } from 'vitest'
import {
	latticePoint,
	triangleCorners,
	trianglesBoundingBox,
} from './triangleLayout'
import type { TriangleLayout } from './triangleLayout'

const layout: TriangleLayout = { size: 10 }

describe('latticePoint', () => {
	it('places the apex (row 0, col 0) at the pixel origin', () => {
		expect(latticePoint(0, 0, layout)).toEqual({ x: 0, y: 0 })
	})

	it('keeps adjacent lattice points in the same row exactly `size` apart', () => {
		const a = latticePoint(3, 1, layout)
		const b = latticePoint(3, 2, layout)
		expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(layout.size, 10)
	})
})

describe('triangleCorners', () => {
	it('returns 3 corners for an "up" triangle, each edge exactly `size` long', () => {
		const corners = triangleCorners(
			{ row: 2, col: 1, direction: 'up' },
			layout,
		)
		expect(corners).toHaveLength(3)
		const [a, b, c] = corners
		expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(layout.size, 10)
		expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeCloseTo(layout.size, 10)
		expect(Math.hypot(a.x - c.x, a.y - c.y)).toBeCloseTo(layout.size, 10)
	})

	it('returns 3 corners for a "down" triangle, each edge exactly `size` long', () => {
		const corners = triangleCorners(
			{ row: 2, col: 0, direction: 'down' },
			layout,
		)
		expect(corners).toHaveLength(3)
		const [a, b, c] = corners
		expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(layout.size, 10)
		expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeCloseTo(layout.size, 10)
		expect(Math.hypot(a.x - c.x, a.y - c.y)).toBeCloseTo(layout.size, 10)
	})
})

describe('trianglesBoundingBox', () => {
	it('spans exactly the min/max of every corner across all triangles', () => {
		const box = trianglesBoundingBox([
			[
				{ x: -5, y: 0 },
				{ x: 5, y: 0 },
				{ x: 0, y: 10 },
			],
			[
				{ x: -10, y: -2 },
				{ x: 0, y: -2 },
				{ x: -5, y: 6 },
			],
		])
		expect(box).toEqual({ minX: -10, minY: -2, maxX: 5, maxY: 10 })
	})
})
