import { describe, expect, it } from 'vitest'
import {
	averagePoint,
	enclosingCircle,
	polygonBoundingBox,
} from './geometryMath'

describe('averagePoint', () => {
	it('averages triangle vertices', () => {
		expect(
			averagePoint([
				{ x: -3, y: 2 },
				{ x: 6, y: 2 },
				{ x: 0, y: 8 },
			]),
		).toEqual({ x: 1, y: 4 })
	})

	it('averages parallelogram vertices', () => {
		expect(
			averagePoint([
				{ x: -4, y: -2 },
				{ x: 2, y: -2 },
				{ x: 4, y: 6 },
				{ x: -2, y: 6 },
			]),
		).toEqual({ x: 0, y: 2 })
	})

	it('leaves a single point unchanged without mutating it', () => {
		const point = Object.freeze({ x: 3, y: -7 })
		expect(averagePoint(Object.freeze([point]))).toEqual(point)
	})

	it('rejects an empty point set explicitly', () => {
		expect(() => averagePoint([])).toThrow(
			'Cannot average an empty set of points',
		)
	})
})

describe('polygonBoundingBox', () => {
	it('uses the actual corners of every polygon, without padding', () => {
		const polygons = [
			[
				{ x: -5, y: 2 },
				{ x: 0, y: -4 },
				{ x: 3, y: 1 },
			],
			[
				{ x: 2, y: 5 },
				{ x: 8, y: 5 },
				{ x: 7, y: 9 },
				{ x: 1, y: 9 },
			],
		] as const

		expect(polygonBoundingBox(polygons)).toEqual({
			minX: -5,
			minY: -4,
			maxX: 8,
			maxY: 9,
		})
	})

	it('does not mutate the supplied points', () => {
		const point = Object.freeze({ x: 3, y: -7 })
		expect(
			polygonBoundingBox(Object.freeze([Object.freeze([point])])),
		).toEqual({
			minX: 3,
			minY: -7,
			maxX: 3,
			maxY: -7,
		})
	})
})

describe('enclosingCircle', () => {
	it('spans two points by their midpoint', () => {
		const circle = enclosingCircle([
			{ x: 0, y: 0 },
			{ x: 6, y: 8 },
		])
		expect(circle.x).toBeCloseTo(3)
		expect(circle.y).toBeCloseTo(4)
		expect(circle.radius).toBeCloseTo(5)
	})

	it('circumscribes an equilateral triangle', () => {
		const side = 2
		const circle = enclosingCircle([
			{ x: 0, y: 0 },
			{ x: side, y: 0 },
			{ x: side / 2, y: (Math.sqrt(3) / 2) * side },
		])
		expect(circle.radius).toBeCloseTo(side / Math.sqrt(3))
	})

	it('ignores points already inside', () => {
		const circle = enclosingCircle([
			{ x: -4, y: 0 },
			{ x: 4, y: 0 },
			{ x: 0, y: 1 },
			{ x: 1, y: -2 },
		])
		expect(circle.x).toBeCloseTo(0)
		expect(circle.y).toBeCloseTo(0)
		expect(circle.radius).toBeCloseTo(4)
	})

	it('handles collinear points and a single point', () => {
		expect(
			enclosingCircle([
				{ x: 0, y: 0 },
				{ x: 1, y: 1 },
				{ x: 3, y: 3 },
			]).radius,
		).toBeCloseTo(Math.hypot(3, 3) / 2)
		expect(enclosingCircle([{ x: 2, y: 5 }])).toEqual({
			x: 2,
			y: 5,
			radius: 0,
		})
	})

	it('holds every point of a scattered set', () => {
		const points = Array.from({ length: 40 }, (_, i) => ({
			x: Math.sin(i * 12.9898) * 50,
			y: Math.cos(i * 78.233) * 30,
		}))
		const { x, y, radius } = enclosingCircle(points)
		for (const point of points)
			expect(Math.hypot(point.x - x, point.y - y)).toBeLessThanOrEqual(
				radius + 1e-6,
			)
	})

	it('rejects an empty point set explicitly', () => {
		expect(() => enclosingCircle([])).toThrow(
			'Cannot enclose an empty set of points',
		)
	})
})
