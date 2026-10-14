import {
	computeGridAspectRatio as computeCircleRingsAspectRatio,
	getGroupIds as getCircleRingsGroupIds,
	CIRCLE_RINGS_GRID_SIZES,
} from '@geometry/circleRingsGrid'
import {
	computeGridAspectRatio as computeDiamondStarAspectRatio,
	getGroupIds as getDiamondStarGroupIds,
	DIAMOND_STAR_GRID_SIZES,
} from '@geometry/diamondStarGrid'
import {
	computeGridAspectRatio as computeHexagonAspectRatio,
	getGroupIds as getHexagonGroupIds,
	HEXAGON_GRID_RADII,
} from '@geometry/hexagonGrid'
import {
	computeGridAspectRatio as computeHexagramAspectRatio,
	getGroupIds as getHexagramGroupIds,
	HEXAGRAM_GRID_SIZES,
} from '@geometry/hexagramGrid'
import {
	computeGridAspectRatio as computePinwheelAspectRatio,
	getGroupIds as getPinwheelGroupIds,
} from '@geometry/pinwheelGrid'
import {
	computeGridAspectRatio as computeTriangleAspectRatio,
	getGroupIds as getTriangleGroupIds,
	TRIANGLE_GRID_SIZES,
} from '@geometry/triangleGrid'
import { defaultGridSizes } from '../data/gridSizes'
import type { GridShapeId } from '../types/gridShape'
import type { GridSize } from '../types/gridSize'

const shapeGeometry = {
	hexagon: {
		getGroupIds: getHexagonGroupIds,
		aspectRatio: computeHexagonAspectRatio,
	},
	triangle: {
		getGroupIds: getTriangleGroupIds,
		aspectRatio: computeTriangleAspectRatio,
	},
	diamondStar: {
		getGroupIds: getDiamondStarGroupIds,
		aspectRatio: computeDiamondStarAspectRatio,
	},
	hexagram: {
		getGroupIds: getHexagramGroupIds,
		aspectRatio: computeHexagramAspectRatio,
	},
	circleRings: {
		getGroupIds: getCircleRingsGroupIds,
		aspectRatio: computeCircleRingsAspectRatio,
	},
	pinwheel: {
		getGroupIds: getPinwheelGroupIds,
		aspectRatio: computePinwheelAspectRatio,
	},
} satisfies Record<
	GridShapeId,
	{
		readonly getGroupIds: () => string[]
		readonly aspectRatio: () => number
	}
>

export function getGroupIdsForShape(
	shape: GridShapeId,
	gridSize: GridSize = defaultGridSizes[shape],
): string[] {
	if (shape === 'hexagon') {
		return getHexagonGroupIds(HEXAGON_GRID_RADII[gridSize])
	}
	if (shape === 'triangle') {
		return getTriangleGroupIds(TRIANGLE_GRID_SIZES[gridSize])
	}
	if (shape === 'diamondStar') {
		return getDiamondStarGroupIds(DIAMOND_STAR_GRID_SIZES[gridSize])
	}
	if (shape === 'hexagram') {
		return getHexagramGroupIds(HEXAGRAM_GRID_SIZES[gridSize])
	}
	if (shape === 'circleRings') {
		return getCircleRingsGroupIds(CIRCLE_RINGS_GRID_SIZES[gridSize])
	}
	return shapeGeometry[shape].getGroupIds()
}

export function computeAspectRatioForShape(
	shape: GridShapeId,
	gridSize: GridSize = defaultGridSizes[shape],
): number {
	if (shape === 'hexagon') {
		return computeHexagonAspectRatio(HEXAGON_GRID_RADII[gridSize])
	}
	if (shape === 'triangle') {
		return computeTriangleAspectRatio(TRIANGLE_GRID_SIZES[gridSize])
	}
	if (shape === 'diamondStar') {
		return computeDiamondStarAspectRatio(DIAMOND_STAR_GRID_SIZES[gridSize])
	}
	if (shape === 'hexagram') {
		return computeHexagramAspectRatio(HEXAGRAM_GRID_SIZES[gridSize])
	}
	if (shape === 'circleRings') {
		return computeCircleRingsAspectRatio(CIRCLE_RINGS_GRID_SIZES[gridSize])
	}
	return shapeGeometry[shape].aspectRatio()
}
