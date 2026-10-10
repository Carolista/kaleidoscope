import { describe, expect, it } from 'vitest'
import * as hexagon from '@geometry/hexagonGrid'
import * as triangle from '@geometry/triangleGrid'
import * as diamondStar from '@geometry/diamondStarGrid'
import * as hexagram from '@geometry/hexagramGrid'
import * as circleRings from '@geometry/circleRingsGrid'
import * as pinwheel from '@geometry/pinwheelGrid'
import { supportedGridShapes } from '@data/gridShapes'
import {
	computeAspectRatioForShape,
	getGroupIdsForShape,
} from './gridShapeRegistry'

const geometry = {
	hexagon,
	triangle,
	diamondStar,
	hexagram,
	circleRings,
	pinwheel,
}

describe('gridShapeRegistry', () => {
	it.each(supportedGridShapes)(
		'dispatches $id to its own geometry with unchanged defaults',
		({ id }) => {
			expect(getGroupIdsForShape(id)).toEqual(geometry[id].getGroupIds())
			expect(computeAspectRatioForShape(id)).toBe(
				geometry[id].computeGridAspectRatio(),
			)
		},
	)
})
