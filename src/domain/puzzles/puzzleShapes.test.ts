import { describe, expect, it } from 'vitest'
import { supportedGridShapes } from '@/domain/shapes'
import {
	PUZZLE_SHAPE_IDS,
	PUZZLE_SHAPE_LABELS,
	puzzleShapes,
} from './puzzleShapes'

describe('puzzle shape order', () => {
	it('follows the catalog unlock order for IDs and label entries', () => {
		const catalogIds = supportedGridShapes.map(shape => shape.id)
		expect(PUZZLE_SHAPE_IDS).toEqual(catalogIds)
		expect(Object.entries(PUZZLE_SHAPE_LABELS)).toEqual(
			supportedGridShapes.map(shape => [shape.id, shape.label]),
		)
	})
})

describe('circle rings off-board piece layout', () => {
	const { pieceCenter, pieceCorners } = puzzleShapes.circleRings
	const directions = [
		{ q: 1, r: 0 },
		{ q: 0, r: 1 },
		{ q: -1, r: 1 },
		{ q: -1, r: 0 },
		{ q: 0, r: -1 },
		{ q: 1, r: -1 },
	]

	it('spaces every neighbor evenly, whatever the offset', () => {
		const spacings = [
			{ q: 0, r: 0 },
			{ q: 3, r: -2 },
			{ q: -4, r: 5 },
		]
			.flatMap(from =>
				directions.map(d => ({
					from,
					to: { q: from.q + d.q, r: from.r + d.r },
				})),
			)
			.map(({ from, to }) => {
				const a = pieceCenter!(from, 30)
				const b = pieceCenter!(to, 30)
				return Math.hypot(a.x - b.x, a.y - b.y)
			})
		for (const spacing of spacings)
			expect(spacing).toBeCloseTo(spacings[0], 9)
	})

	it('draws equal circles that clear their neighbors', () => {
		const [a, b] = [
			pieceCenter!({ q: 0, r: 0 }, 30),
			pieceCenter!({ q: 1, r: 0 }, 30),
		]
		const points = pieceCorners!({ q: 0, r: 0 }, 30)
		const radius = Math.hypot(points[0].x - a.x, points[0].y - a.y)
		expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(radius * 2)
	})

	it('keeps the up direction up, like the board', () => {
		const origin = pieceCenter!({ q: 0, r: 0 }, 30)
		const up = pieceCenter!({ q: 0, r: -1 }, 30)
		expect(up.x - origin.x).toBeCloseTo(0, 9)
		expect(up.y).toBeLessThan(origin.y)
	})
})
