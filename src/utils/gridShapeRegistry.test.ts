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
import { HEXAGRAM_GRID_SIZES } from '@geometry/hexagramGrid'
import { CIRCLE_RINGS_GRID_SIZES } from '@geometry/circleRingsGrid'
import { PINWHEEL_GRID_SIZES } from '@geometry/pinwheelGrid'
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
			const expectedGroupIds =
				id === 'hexagon'
					? hexagon.getGroupIds(HEXAGON_GRID_RADII[size])
					: id === 'triangle'
						? triangle.getGroupIds(TRIANGLE_GRID_SIZES[size])
						: id === 'diamondStar'
							? diamondStar.getGroupIds(
									DIAMOND_STAR_GRID_SIZES[size],
								)
							: id === 'hexagram'
								? hexagram.getGroupIds(
										HEXAGRAM_GRID_SIZES[size],
									)
								: id === 'circleRings'
									? circleRings.getGroupIds(
											CIRCLE_RINGS_GRID_SIZES[size],
										)
									: pinwheel.getGroupIds(
											PINWHEEL_GRID_SIZES[size].rowSteps,
											PINWHEEL_GRID_SIZES[size].colSteps,
										)
			expect(getGroupIdsForShape(id)).toEqual(expectedGroupIds)
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

	it('uses the selected Hexagram size when computing groups and aspect ratio', () => {
		expect(getGroupIdsForShape('hexagram', 'sm')).toEqual(
			hexagram.getGroupIds(2),
		)
		expect(getGroupIdsForShape('hexagram', 'md')).toEqual(
			hexagram.getGroupIds(3),
		)
		expect(getGroupIdsForShape('hexagram', 'lg')).toEqual(
			hexagram.getGroupIds(4),
		)
		expect(computeAspectRatioForShape('hexagram', 'md')).toBe(
			hexagram.computeGridAspectRatio(3),
		)
	})

	it('uses the selected Circle Rings size when computing groups and aspect ratio', () => {
		expect(getGroupIdsForShape('circleRings', 'sm')).toEqual(
			circleRings.getGroupIds(3),
		)
		expect(getGroupIdsForShape('circleRings', 'md')).toEqual(
			circleRings.getGroupIds(4),
		)
		expect(getGroupIdsForShape('circleRings', 'lg')).toEqual(
			circleRings.getGroupIds(6),
		)
		expect(computeAspectRatioForShape('circleRings', 'sm')).toBe(
			circleRings.computeGridAspectRatio(3),
		)
	})

	it('uses the selected Pinwheel size when computing groups and aspect ratio', () => {
		for (const size of ['sm', 'md', 'lg'] as const) {
			const { rowSteps, colSteps } = PINWHEEL_GRID_SIZES[size]
			expect(getGroupIdsForShape('pinwheel', size)).toEqual(
				pinwheel.getGroupIds(rowSteps, colSteps),
			)
			expect(computeAspectRatioForShape('pinwheel', size)).toBe(
				pinwheel.computeGridAspectRatio(rowSteps, colSteps),
			)
		}
	})
})
