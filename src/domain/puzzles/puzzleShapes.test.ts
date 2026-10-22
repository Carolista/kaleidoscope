import { describe, expect, it } from 'vitest'
import { supportedGridShapes } from '@/domain/shapes'
import { PUZZLE_SHAPE_IDS, PUZZLE_SHAPE_LABELS } from './puzzleShapes'

describe('puzzle shape order', () => {
	it('follows the catalog unlock order for IDs and label entries', () => {
		const catalogIds = supportedGridShapes.map(shape => shape.id)
		expect(PUZZLE_SHAPE_IDS).toEqual(catalogIds)
		expect(Object.entries(PUZZLE_SHAPE_LABELS)).toEqual(
			supportedGridShapes.map(shape => [shape.id, shape.label]),
		)
	})
})
