import type { GridShapeId } from './catalog'
import { defaultGridSizes, type GridSize } from './sizes'
import * as circleRings from './circle-rings'
import * as diamondStar from './diamond-star'
import * as hexagon from './hexagon'
import * as hexagram from './hexagram'
import * as pinwheel from './pinwheel'
import * as triangle from './triangle'

export interface ShapeDefinition {
	readonly getGroupIds: (gridSize: GridSize) => string[]
	readonly computeAspectRatio: (gridSize: GridSize) => number
}

// Keyed by every GridShapeId, so adding a shape fails to compile until it is registered.
const shapeDefinitions: { readonly [Id in GridShapeId]: ShapeDefinition } = {
	hexagon: {
		getGroupIds: size =>
			hexagon.getGroupIds(hexagon.HEXAGON_GRID_RADII[size]),
		computeAspectRatio: size =>
			hexagon.computeGridAspectRatio(hexagon.HEXAGON_GRID_RADII[size]),
	},
	triangle: {
		getGroupIds: size =>
			triangle.getGroupIds(triangle.TRIANGLE_GRID_SIZES[size]),
		computeAspectRatio: size =>
			triangle.computeGridAspectRatio(triangle.TRIANGLE_GRID_SIZES[size]),
	},
	diamondStar: {
		getGroupIds: size =>
			diamondStar.getGroupIds(diamondStar.DIAMOND_STAR_GRID_SIZES[size]),
		computeAspectRatio: size =>
			diamondStar.computeGridAspectRatio(
				diamondStar.DIAMOND_STAR_GRID_SIZES[size],
			),
	},
	hexagram: {
		getGroupIds: size =>
			hexagram.getGroupIds(hexagram.HEXAGRAM_GRID_SIZES[size]),
		computeAspectRatio: size =>
			hexagram.computeGridAspectRatio(hexagram.HEXAGRAM_GRID_SIZES[size]),
	},
	circleRings: {
		getGroupIds: size =>
			circleRings.getGroupIds(circleRings.CIRCLE_RINGS_GRID_SIZES[size]),
		computeAspectRatio: size =>
			circleRings.computeGridAspectRatio(
				circleRings.CIRCLE_RINGS_GRID_SIZES[size],
			),
	},
	pinwheel: {
		getGroupIds: size => {
			const { rowSteps, colSteps } = pinwheel.PINWHEEL_GRID_SIZES[size]
			return pinwheel.getGroupIds(rowSteps, colSteps)
		},
		computeAspectRatio: size => {
			const { rowSteps, colSteps } = pinwheel.PINWHEEL_GRID_SIZES[size]
			return pinwheel.computeGridAspectRatio(rowSteps, colSteps)
		},
	},
}

export function getGroupIdsForShape(
	shape: GridShapeId,
	gridSize: GridSize = defaultGridSizes[shape],
): string[] {
	return shapeDefinitions[shape].getGroupIds(gridSize)
}

export function computeAspectRatioForShape(
	shape: GridShapeId,
	gridSize: GridSize = defaultGridSizes[shape],
): number {
	return shapeDefinitions[shape].computeAspectRatio(gridSize)
}
