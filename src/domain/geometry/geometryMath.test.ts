import { describe, expect, it } from 'vitest'
import { averagePoint, polygonBoundingBox } from './geometryMath'

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
