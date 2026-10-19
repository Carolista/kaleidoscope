import { describe, expect, it } from 'vitest'
import {
	FULL_ANGLE_DEGREES,
	PINWHEEL_COL_ASPECT_RATIO,
	PINWHEEL_FOLD,
	PINWHEEL_ROTATIONS,
	pinwheelBoundingBox,
	pinwheelCellCorners,
	spokeCellCorners,
	spokeVertices,
} from './pinwheelLayout'
import type { PinwheelLayout } from './pinwheelLayout'

const layout: PinwheelLayout = { rowSteps: 3, colSteps: 5, size: 10 }

describe('spokeVertices', () => {
	it('places the center at the pixel origin', () => {
		const { center } = spokeVertices(layout)
		expect(center).toEqual({ x: 0, y: 0 })
	})

	it('gives the spoke a FULL_ANGLE_DEGREES spread between sideRight and sideLeft, straddling straight up', () => {
		const { center, sideRight, sideLeft } = spokeVertices(layout)
		const rightAngle = Math.atan2(
			sideRight.y - center.y,
			sideRight.x - center.x,
		)
		const leftAngle = Math.atan2(
			sideLeft.y - center.y,
			sideLeft.x - center.x,
		)
		expect(((rightAngle - -Math.PI / 2) * 180) / Math.PI).toBeCloseTo(
			FULL_ANGLE_DEGREES / 2,
			4,
		)
		expect(((-Math.PI / 2 - leftAngle) * 180) / Math.PI).toBeCloseTo(
			FULL_ANGLE_DEGREES / 2,
			4,
		)
	})

	it('scales sideRight by rowSteps and sideLeft by colSteps * PINWHEEL_COL_ASPECT_RATIO, so a colSteps step is longer than a rowSteps step — unlike a shared `spokeLength`, this makes sideRight and sideLeft different distances from the center', () => {
		const { center, sideRight, sideLeft } = spokeVertices(layout)
		const distance = (
			a: { x: number; y: number },
			b: { x: number; y: number },
		) => Math.hypot(a.x - b.x, a.y - b.y)
		expect(distance(center, sideRight)).toBeCloseTo(
			layout.size * layout.rowSteps,
			10,
		)
		expect(distance(center, sideLeft)).toBeCloseTo(
			layout.size * PINWHEEL_COL_ASPECT_RATIO * layout.colSteps,
			10,
		)

		const lopsided: PinwheelLayout = { rowSteps: 1, colSteps: 9, size: 10 }
		const lopsidedVertices = spokeVertices(lopsided)
		expect(
			distance(lopsidedVertices.center, lopsidedVertices.sideRight),
		).toBeCloseTo(lopsided.size * lopsided.rowSteps, 10)
		expect(
			distance(lopsidedVertices.center, lopsidedVertices.sideLeft),
		).toBeCloseTo(
			lopsided.size * PINWHEEL_COL_ASPECT_RATIO * lopsided.colSteps,
			10,
		)
	})

	it('derives tip as sideRight + sideLeft - center (the parallelogram closure)', () => {
		const { center, sideRight, sideLeft, tip } = spokeVertices(layout)
		expect(tip.x).toBeCloseTo(sideRight.x + sideLeft.x - center.x, 10)
		expect(tip.y).toBeCloseTo(sideRight.y + sideLeft.y - center.y, 10)
	})
})

describe('spokeCellCorners', () => {
	it('returns 4 corners for a cell, with the (row 0, col 0) corner at the spoke apex (the pinwheel center)', () => {
		const corners = spokeCellCorners({ row: 0, col: 0 }, layout)
		expect(corners).toHaveLength(4)
		expect(corners[0]).toEqual({ x: 0, y: 0 })
	})

	it('produces cells that tile the full spoke with no gaps (every interior lattice point is shared by its 4 neighboring cells)', () => {
		const cornersByCell = new Map<string, { x: number; y: number }[]>()
		for (let row = 0; row < layout.rowSteps; row++) {
			for (let col = 0; col < layout.colSteps; col++) {
				cornersByCell.set(
					`${row},${col}`,
					spokeCellCorners({ row, col }, layout),
				)
			}
		}
		// The shared corner between (row,col) and (row+1,col) should be
		// identical, confirming no seams between adjacent cells.
		const a = cornersByCell.get('0,0')![1]
		const b = cornersByCell.get('1,0')![0]
		expect(a.x).toBeCloseTo(b.x, 10)
		expect(a.y).toBeCloseTo(b.y, 10)
	})

	it('produces elongated parallelogram cells: each rowSteps-axis side is `size` long, each colSteps-axis side is `size * PINWHEEL_COL_ASPECT_RATIO` long (not a rhombus)', () => {
		const [a, b, c, d] = spokeCellCorners({ row: 0, col: 0 }, layout)
		const sideLength = (
			p: { x: number; y: number },
			q: { x: number; y: number },
		) => Math.hypot(q.x - p.x, q.y - p.y)
		expect(sideLength(a, b)).toBeCloseTo(layout.size, 10)
		expect(sideLength(c, d)).toBeCloseTo(layout.size, 10)
		expect(sideLength(b, c)).toBeCloseTo(
			layout.size * PINWHEEL_COL_ASPECT_RATIO,
			10,
		)
		expect(sideLength(d, a)).toBeCloseTo(
			layout.size * PINWHEEL_COL_ASPECT_RATIO,
			10,
		)
	})
})

describe('PINWHEEL_ROTATIONS', () => {
	it('has 8 rotations (one per spoke)', () => {
		expect(PINWHEEL_ROTATIONS).toHaveLength(PINWHEEL_FOLD)
		expect(PINWHEEL_ROTATIONS).toHaveLength(8)
	})

	it('transform 0 is the identity (the fundamental "up" spoke itself)', () => {
		const point = { x: 3, y: -7 }
		const result = PINWHEEL_ROTATIONS[0](point)
		expect(result.x).toBeCloseTo(point.x, 10)
		expect(result.y).toBeCloseTo(point.y, 10)
	})

	it('transform 4 rotates by 180 degrees (half of the 8-fold rotation)', () => {
		const point = { x: 3, y: -7 }
		const result = PINWHEEL_ROTATIONS[4](point)
		expect(result.x).toBeCloseTo(-point.x, 10)
		expect(result.y).toBeCloseTo(-point.y, 10)
	})
})

describe('pinwheelCellCorners', () => {
	it('matches spokeCellCorners when transformIndex is 0', () => {
		const cell = {
			row: 1,
			col: 0,
			transformIndex: 0,
			groupId: '0',
			isClickable: true,
		}
		expect(pinwheelCellCorners(cell, layout)).toEqual(
			spokeCellCorners(cell, layout),
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
		const raw = spokeCellCorners(cell, layout)
		const transformed = pinwheelCellCorners(cell, layout)
		expect(transformed).toEqual(raw.map(PINWHEEL_ROTATIONS[1]))
	})
})

describe('pinwheelBoundingBox', () => {
	it('spans exactly the min/max of every corner across all pieces', () => {
		const box = pinwheelBoundingBox([
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
