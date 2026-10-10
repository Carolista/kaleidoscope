import { describe, expect, it } from 'vitest'
import { gridShapes, isGridShapeId, supportedGridShapes } from './gridShapes'

describe('grid shape definitions', () => {
	it('preserves supported IDs, labels, and current picker order', () => {
		const expected = [
			['hexagon', 'Hexagon'],
			['triangle', 'Triangle'],
			['diamondStar', 'Diamond Star'],
			['hexagram', 'Hexagram'],
			['circleRings', 'Circle Rings'],
			['pinwheel', 'Pinwheel'],
		]
		expect(
			supportedGridShapes.map(shape => [shape.id, shape.label]),
		).toEqual(expected)
		expect(gridShapes.map(shape => [shape.id, shape.label])).toEqual(
			expected,
		)
		expect(new Set(supportedGridShapes.map(shape => shape.id)).size).toBe(
			supportedGridShapes.length,
		)
	})

	it('derives picker entries from visibility without using visibility for supported-ID validation', () => {
		expect(gridShapes).toEqual(
			supportedGridShapes.filter(shape => shape.pickerVisible),
		)
		for (const shape of supportedGridShapes) {
			expect(isGridShapeId(shape.id)).toBe(true)
		}
	})

	it.each([undefined, null, '', 'octagon', 'toString', 1, {}, ['hexagon']])(
		'rejects an unsupported shape value: %j',
		value => {
			expect(isGridShapeId(value)).toBe(false)
		},
	)
})
