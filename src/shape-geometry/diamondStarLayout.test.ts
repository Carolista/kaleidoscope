import { describe, expect, it } from 'vitest'
import {
	DIAMOND_STAR_ROTATIONS,
	HALF_ANGLE_DEGREES,
	diamondCellCorners,
	diamondStarBoundingBox,
	diamondStarCellCorners,
	diamondVertices,
} from './diamondStarLayout'
import type { DiamondStarLayout } from './diamondStarLayout'

const layout: DiamondStarLayout = { gridSize: 4, size: 10 }

describe('diamondVertices', () => {
	it('places the center at the pixel origin and the tip straight up (negative y)', () => {
		const { center, tip } = diamondVertices(layout)
		expect(center).toEqual({ x: 0, y: 0 })
		expect(tip.x).toBeCloseTo(0, 10)
		expect(tip.y).toBeCloseTo(-(layout.gridSize * layout.size), 10)
	})

	it('gives the diamond a HALF_ANGLE_DEGREES spread between its center->tip axis and each side vertex (half of the point angle), mirrored left/right', () => {
		const { center, sideRight, sideLeft } = diamondVertices(layout)
		const rightAngle = Math.atan2(
			sideRight.y - center.y,
			sideRight.x - center.x,
		)
		const leftAngle = Math.atan2(
			sideLeft.y - center.y,
			sideLeft.x - center.x,
		)
		expect(((rightAngle - -Math.PI / 2) * 180) / Math.PI).toBeCloseTo(
			HALF_ANGLE_DEGREES,
			4,
		)
		expect(((-Math.PI / 2 - leftAngle) * 180) / Math.PI).toBeCloseTo(
			HALF_ANGLE_DEGREES,
			4,
		)
	})

	it('places the two side vertices the same distance from the center (so the lattice steps toward each are equal-length, making every cell a true rhombus)', () => {
		const { center, sideRight, sideLeft } = diamondVertices(layout)
		const distance = (
			a: { x: number; y: number },
			b: { x: number; y: number },
		) => Math.hypot(a.x - b.x, a.y - b.y)
		expect(distance(center, sideRight)).toBeCloseTo(
			distance(center, sideLeft),
			10,
		)
	})
})

describe('diamondCellCorners', () => {
	it('returns 4 corners for a cell, with the (row 0, col 0) corner at the diamond apex (the star center)', () => {
		const corners = diamondCellCorners({ row: 0, col: 0 }, layout)
		expect(corners).toHaveLength(4)
		expect(corners[0]).toEqual({ x: 0, y: 0 })
	})

	it('produces a true rhombus (all 4 sides equal length) for every cell', () => {
		for (let row = 0; row < layout.gridSize; row++) {
			for (let col = 0; col < layout.gridSize; col++) {
				const [a, b, c, d] = diamondCellCorners({ row, col }, layout)
				const side = (p: typeof a, q: typeof a) =>
					Math.hypot(p.x - q.x, p.y - q.y)
				const sides = [side(a, b), side(b, c), side(c, d), side(d, a)]
				for (const length of sides) {
					expect(length).toBeCloseTo(sides[0], 8)
				}
			}
		}
	})
})

describe('DIAMOND_STAR_ROTATIONS', () => {
	it('has 6 rotations (one per diamond point)', () => {
		expect(DIAMOND_STAR_ROTATIONS).toHaveLength(6)
	})

	it('transform 0 is the identity (the fundamental "up" diamond point itself)', () => {
		const point = { x: 3, y: -7 }
		const result = DIAMOND_STAR_ROTATIONS[0](point)
		expect(result.x).toBeCloseTo(point.x, 10)
		expect(result.y).toBeCloseTo(point.y, 10)
	})

	it('transform 3 rotates by 180 degrees (half of the 6-fold rotation)', () => {
		const point = { x: 3, y: -7 }
		const result = DIAMOND_STAR_ROTATIONS[3](point)
		expect(result.x).toBeCloseTo(-point.x, 10)
		expect(result.y).toBeCloseTo(-point.y, 10)
	})
})

describe('diamondStarCellCorners', () => {
	it('matches diamondCellCorners when transformIndex is 0', () => {
		const cell = {
			row: 1,
			col: 0,
			transformIndex: 0,
			groupId: '0',
			isClickable: true,
		}
		expect(diamondStarCellCorners(cell, layout)).toEqual(
			diamondCellCorners(cell, layout),
		)
	})

	it('transforms the corners when transformIndex is nonzero', () => {
		const cell = {
			row: 1,
			col: 0,
			transformIndex: 1,
			groupId: '0',
			isClickable: true,
		}
		const raw = diamondCellCorners(cell, layout)
		const transformed = diamondStarCellCorners(cell, layout)
		expect(transformed).toEqual(raw.map(DIAMOND_STAR_ROTATIONS[1]))
	})
})

describe('diamondStarBoundingBox', () => {
	it('spans exactly the min/max of every corner across all rhombi', () => {
		const box = diamondStarBoundingBox([
			[
				{ x: -5, y: 0 },
				{ x: 5, y: 0 },
				{ x: 0, y: 10 },
				{ x: -2, y: 4 },
			],
			[
				{ x: -10, y: -2 },
				{ x: 0, y: -2 },
				{ x: -5, y: 6 },
				{ x: -7, y: 2 },
			],
		])
		expect(box).toEqual({ minX: -10, minY: -2, maxX: 5, maxY: 10 })
	})
})
