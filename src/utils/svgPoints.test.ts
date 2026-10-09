import { describe, expect, it } from 'vitest'
import { pointsToSvgAttr } from './svgPoints'

describe('pointsToSvgAttr', () => {
	it('formats points as a space-separated "x,y" list', () => {
		expect(
			pointsToSvgAttr([
				{ x: 1, y: 2 },
				{ x: 3, y: 4 },
			]),
		).toBe('1,2 3,4')
	})
})
