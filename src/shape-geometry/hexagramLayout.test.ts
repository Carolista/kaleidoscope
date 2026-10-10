import { describe, expect, it } from 'vitest'
import {
	HEXAGRAM_ROTATIONS,
	hexagramBoundingBox,
	hexagramCellCorners,
	hexagramStarCellCorners,
	hexagramVertices,
} from './hexagramLayout'
import type { HexagramLayout } from './hexagramLayout'

const layout: HexagramLayout = { gridSize: 4, size: 10 }

describe('hexagramVertices', () => {
	it('places the center at the pixel origin and the tip straight up (negative y)', () => {
		const { center, tip } = hexagramVertices(layout)
		expect(center).toEqual({ x: 0, y: 0 })
		expect(tip.x).toBeCloseTo(0, 10)
		expect(tip.y).toBeLessThan(0)
	})

	it('places the 2 hexagon-edge vertices the same distance from both the center and the tip (so the hex-sector and point triangles are both equilateral)', () => {
		const { center, hexEdgeRight, hexEdgeLeft, tip } =
			hexagramVertices(layout)
		const dist = (a: typeof center, b: typeof center) =>
			Math.hypot(a.x - b.x, a.y - b.y)
		const edge = dist(hexEdgeLeft, hexEdgeRight)
		expect(dist(center, hexEdgeRight)).toBeCloseTo(edge, 8)
		expect(dist(center, hexEdgeLeft)).toBeCloseTo(edge, 8)
		expect(dist(tip, hexEdgeRight)).toBeCloseTo(edge, 8)
		expect(dist(tip, hexEdgeLeft)).toBeCloseTo(edge, 8)
	})

	it('mirrors the 2 hexagon-edge vertices left/right across the spoke axis', () => {
		const { hexEdgeRight, hexEdgeLeft } = hexagramVertices(layout)
		expect(hexEdgeLeft.x).toBeCloseTo(-hexEdgeRight.x, 10)
		expect(hexEdgeLeft.y).toBeCloseTo(hexEdgeRight.y, 10)
	})
})

describe('hexagramCellCorners', () => {
	it('returns 3 corners for a hexSector cell, with the row-0 corner at the spoke apex (the star center)', () => {
		const corners = hexagramCellCorners(
			{ piece: 'hexSector', row: 0, col: 0, direction: 'up' },
			layout,
		)
		expect(corners).toHaveLength(3)
		expect(corners[0]).toEqual({ x: 0, y: 0 })
	})

	it('returns 3 corners for a point cell, with the row-0 corner at the tip', () => {
		const { tip } = hexagramVertices(layout)
		const corners = hexagramCellCorners(
			{ piece: 'point', row: 0, col: 0, direction: 'up' },
			layout,
		)
		expect(corners).toHaveLength(3)
		expect(corners[0].x).toBeCloseTo(tip.x, 8)
		expect(corners[0].y).toBeCloseTo(tip.y, 8)
	})

	it('produces a true equilateral triangle (all 3 sides equal length) for every cell, in both pieces', () => {
		for (const piece of ['hexSector', 'point'] as const) {
			for (let row = 0; row < layout.gridSize; row++) {
				for (let col = 0; col <= row; col++) {
					const corners = hexagramCellCorners(
						{ piece, row, col, direction: 'up' },
						layout,
					)
					const [a, b, c] = corners
					const side = (p: typeof a, q: typeof a) =>
						Math.hypot(p.x - q.x, p.y - q.y)
					const sides = [side(a, b), side(b, c), side(c, a)]
					expect(sides[1]).toBeCloseTo(sides[0], 8)
					expect(sides[2]).toBeCloseTo(sides[0], 8)
				}
			}
		}
	})
})

describe('HEXAGRAM_ROTATIONS', () => {
	it('has 6 rotations (one per spoke)', () => {
		expect(HEXAGRAM_ROTATIONS).toHaveLength(6)
	})

	it('transform 0 is the identity (the fundamental "up" spoke itself)', () => {
		const point = { x: 3, y: -7 }
		const result = HEXAGRAM_ROTATIONS[0](point)
		expect(result.x).toBeCloseTo(point.x, 10)
		expect(result.y).toBeCloseTo(point.y, 10)
	})

	it('transform 3 rotates by 180 degrees (half of the 6-fold rotation)', () => {
		const point = { x: 3, y: -7 }
		const result = HEXAGRAM_ROTATIONS[3](point)
		expect(result.x).toBeCloseTo(-point.x, 10)
		expect(result.y).toBeCloseTo(-point.y, 10)
	})
})

describe('hexagramStarCellCorners', () => {
	it('matches hexagramCellCorners when transformIndex is 0', () => {
		const cell = {
			piece: 'hexSector' as const,
			row: 1,
			col: 0,
			direction: 'up' as const,
			transformIndex: 0,
			groupId: '0',
			isClickable: true,
		}
		expect(hexagramStarCellCorners(cell, layout)).toEqual(
			hexagramCellCorners(cell, layout),
		)
	})

	it('transforms the corners when transformIndex is nonzero', () => {
		const cell = {
			piece: 'point' as const,
			row: 1,
			col: 0,
			direction: 'up' as const,
			transformIndex: 1,
			groupId: '0',
			isClickable: true,
		}
		const raw = hexagramCellCorners(cell, layout)
		const transformed = hexagramStarCellCorners(cell, layout)
		expect(transformed).toEqual(raw.map(HEXAGRAM_ROTATIONS[1]))
	})
})

describe('hexagramBoundingBox', () => {
	it('spans exactly the min/max of every corner across all triangles', () => {
		const box = hexagramBoundingBox([
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
