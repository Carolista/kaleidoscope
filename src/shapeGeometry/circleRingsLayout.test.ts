import { describe, expect, it } from 'vitest'
import {
	GROWTH_STEP_RATIO,
	RING_GAP,
	circleCountForRing,
	circleRingsBoundingBox,
	circleRingsCellCenter,
	circleRingsCellDiameter,
	circleRingsCellRadius,
	ringCenterRadius,
} from './circleRingsLayout'
import type { CircleRingsLayout } from './circleRingsLayout'

const layout: CircleRingsLayout = { ringCount: 7, size: 10 }

describe('circleCountForRing', () => {
	it('is 6 times the ring number, so every ring is a multiple of the 6-fold symmetry', () => {
		expect(circleCountForRing(1)).toBe(6)
		expect(circleCountForRing(2)).toBe(12)
		expect(circleCountForRing(7)).toBe(42)
	})
})

describe('circleRingsCellDiameter', () => {
	it('gives the center dot (ring 0) and ring 1 the same, smallest diameter', () => {
		expect(circleRingsCellDiameter(0, layout)).toBe(layout.size)
		expect(circleRingsCellDiameter(1, layout)).toBe(layout.size)
	})

	it('grows from the floor diameter by GROWTH_STEP_RATIO per ring, from ring 2 onward', () => {
		expect(circleRingsCellDiameter(2, layout)).toBeCloseTo(
			layout.size + layout.size * GROWTH_STEP_RATIO,
			10,
		)
		expect(circleRingsCellDiameter(4, layout)).toBeCloseTo(
			layout.size + 3 * layout.size * GROWTH_STEP_RATIO,
			10,
		)
	})

	it('strictly increases from one ring to the next, from ring 1 onward', () => {
		for (let ring = 1; ring < layout.ringCount; ring++) {
			expect(circleRingsCellDiameter(ring, layout)).toBeLessThan(
				circleRingsCellDiameter(ring + 1, layout),
			)
		}
	})
})

describe('ringCenterRadius', () => {
	it('is 0 for the center dot', () => {
		expect(ringCenterRadius(0, layout)).toBe(0)
	})

	it('strictly increases from one ring to the next', () => {
		for (let ring = 1; ring < layout.ringCount; ring++) {
			expect(ringCenterRadius(ring, layout)).toBeLessThan(
				ringCenterRadius(ring + 1, layout),
			)
		}
	})

	it('never lets same-ring neighbors overlap, at any ring count', () => {
		for (const ringCount of [1, 2, 7, 20, 50]) {
			const bigLayout: CircleRingsLayout = { ringCount, size: 1 }
			for (let ring = 1; ring <= ringCount; ring++) {
				const diameter = circleRingsCellDiameter(ring, bigLayout)
				const center = ringCenterRadius(ring, bigLayout)
				const count = circleCountForRing(ring)
				const chordToNeighbor = 2 * center * Math.sin(Math.PI / count)
				expect(chordToNeighbor).toBeGreaterThanOrEqual(
					diameter * RING_GAP - 1e-9,
				)
			}
		}
	})

	it("never lets a ring's circles overlap the previous ring's circles", () => {
		for (const ringCount of [1, 2, 7, 20, 50]) {
			const bigLayout: CircleRingsLayout = { ringCount, size: 1 }
			let previousRadius = 0
			let previousDiameter = bigLayout.size
			for (let ring = 1; ring <= ringCount; ring++) {
				const diameter = circleRingsCellDiameter(ring, bigLayout)
				const center = ringCenterRadius(ring, bigLayout)
				expect(center - previousRadius).toBeGreaterThanOrEqual(
					((previousDiameter + diameter) / 2) * RING_GAP - 1e-9,
				)
				previousRadius = center
				previousDiameter = diameter
			}
		}
	})
})

describe('circleRingsCellRadius', () => {
	it('gives the center dot (ring 0) and ring 1 the same, smallest radius', () => {
		const centerRadius = circleRingsCellRadius({ ring: 0 }, layout)
		expect(centerRadius).toBe(circleRingsCellRadius({ ring: 1 }, layout))
		for (let ring = 2; ring <= layout.ringCount; ring++) {
			expect(centerRadius).toBeLessThan(
				circleRingsCellRadius({ ring }, layout),
			)
		}
	})

	it('strictly increases from one ring to the next, from ring 1 onward', () => {
		for (let ring = 1; ring < layout.ringCount; ring++) {
			expect(circleRingsCellRadius({ ring }, layout)).toBeLessThan(
				circleRingsCellRadius({ ring: ring + 1 }, layout),
			)
		}
	})
})

describe('circleRingsCellCenter', () => {
	it("places the ring-0 cell at the shape's own center", () => {
		expect(circleRingsCellCenter({ ring: 0, index: 0 }, layout)).toEqual({
			x: 0,
			y: 0,
		})
	})

	it('places index 0 of every ring straight up, matching the other shapes\' "up" spoke convention', () => {
		for (let ring = 1; ring <= layout.ringCount; ring++) {
			const center = circleRingsCellCenter({ ring, index: 0 }, layout)
			expect(center.x).toBeCloseTo(0, 10)
			expect(center.y).toBeCloseTo(-ringCenterRadius(ring, layout), 10)
		}
	})

	it('spaces every circle in a ring evenly around it', () => {
		const ring = 3
		const count = circleCountForRing(ring)
		const radius = ringCenterRadius(ring, layout)
		for (let index = 0; index < count; index++) {
			const center = circleRingsCellCenter({ ring, index }, layout)
			expect(Math.hypot(center.x, center.y)).toBeCloseTo(radius, 10)
		}
	})
})

describe('circleRingsBoundingBox', () => {
	it("spans exactly the min/max of every circle's extent (center +/- radius)", () => {
		const box = circleRingsBoundingBox([
			{ center: { x: 0, y: 0 }, radius: 1 },
			{ center: { x: 5, y: -3 }, radius: 2 },
		])
		expect(box).toEqual({ minX: -1, minY: -5, maxX: 7, maxY: 1 })
	})
})
