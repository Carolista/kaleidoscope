import { describe, expect, it } from 'vitest'
import * as hexagon from '@geometry/hexagonGrid'
import * as triangle from '@geometry/triangleGrid'
import * as diamondStar from '@geometry/diamondStarGrid'
import * as hexagram from '@geometry/hexagramGrid'
import * as circleRings from '@geometry/circleRingsGrid'
import * as pinwheel from '@geometry/pinwheelGrid'
import { supportedGridShapes } from '@data/gridShapes'
import { defaultGridSizes } from '@data/gridSizes'
import { HEXAGON_GRID_RADII } from '@geometry/hexagonGrid'
import { TRIANGLE_GRID_SIZES } from '@geometry/triangleGrid'
import { DIAMOND_STAR_GRID_SIZES } from '@geometry/diamondStarGrid'
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
			const size = defaultGridSizes[id]
			const gridSize =
				id === 'hexagon'
					? HEXAGON_GRID_RADII[size]
					: id === 'triangle'
						? TRIANGLE_GRID_SIZES[size]
						: id === 'diamondStar'
							? DIAMOND_STAR_GRID_SIZES[size]
							: undefined
			expect(getGroupIdsForShape(id)).toEqual(
				gridSize === undefined
					? geometry[id].getGroupIds()
					: geometry[id].getGroupIds(gridSize),
			)
			expect(computeAspectRatioForShape(id)).toBeCloseTo(
				geometry[id].computeGridAspectRatio(),
				12,
			)
		},
	)

	it('uses the selected hexagon size when computing its aspect ratio', () => {
		expect(computeAspectRatioForShape('hexagon', 'sm')).toBe(
			hexagon.computeGridAspectRatio(3),
		)
		expect(computeAspectRatioForShape('hexagon', 'lg')).toBe(
			hexagon.computeGridAspectRatio(6),
		)
	})

	it('uses the selected triangle size when computing its group ids and aspect ratio', () => {
		expect(getGroupIdsForShape('triangle', 'sm')).toEqual(
			triangle.getGroupIds(4),
		)
		expect(getGroupIdsForShape('triangle', 'md')).toEqual(
			triangle.getGroupIds(7),
		)
		expect(getGroupIdsForShape('triangle', 'lg')).toEqual(
			triangle.getGroupIds(10),
		)
		expect(computeAspectRatioForShape('triangle', 'sm')).toBe(
			triangle.computeGridAspectRatio(4),
		)
	})

	it('uses the selected Diamond Star size when computing groups and aspect ratio', () => {
		expect(getGroupIdsForShape('diamondStar', 'sm')).toEqual(
			diamondStar.getGroupIds(3),
		)
		expect(getGroupIdsForShape('diamondStar', 'md')).toEqual(
			diamondStar.getGroupIds(4),
		)
		expect(getGroupIdsForShape('diamondStar', 'lg')).toEqual(
			diamondStar.getGroupIds(5),
		)
		expect(computeAspectRatioForShape('diamondStar', 'lg')).toBe(
			diamondStar.computeGridAspectRatio(5),
		)
	})
})
