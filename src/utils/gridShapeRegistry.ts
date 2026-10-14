import {
	computeGridAspectRatio as computeCircleRingsAspectRatio,
	getGroupIds as getCircleRingsGroupIds,
} from '@geometry/circleRingsGrid'
import {
	computeGridAspectRatio as computeDiamondStarAspectRatio,
	getGroupIds as getDiamondStarGroupIds,
} from '@geometry/diamondStarGrid'
import {
	computeGridAspectRatio as computeHexagonAspectRatio,
	getGroupIds as getHexagonGroupIds,
	HEXAGON_GRID_RADII,
} from '@geometry/hexagonGrid'
import {
	computeGridAspectRatio as computeHexagramAspectRatio,
	getGroupIds as getHexagramGroupIds,
} from '@geometry/hexagramGrid'
import {
	computeGridAspectRatio as computePinwheelAspectRatio,
	getGroupIds as getPinwheelGroupIds,
} from '@geometry/pinwheelGrid'
import {
	computeGridAspectRatio as computeTriangleAspectRatio,
	getGroupIds as getTriangleGroupIds,
} from '@geometry/triangleGrid'
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
	gridSize: GridSize = 'md',
): string[] {
	if (shape === 'hexagon') {
		return getHexagonGroupIds(HEXAGON_GRID_RADII[gridSize])
	}
	return shapeGeometry[shape].getGroupIds()
}

export function computeAspectRatioForShape(
	shape: GridShapeId,
	gridSize: GridSize = 'md',
): number {
	if (shape === 'hexagon') {
		return computeHexagonAspectRatio(HEXAGON_GRID_RADII[gridSize])
	}
	return shapeGeometry[shape].aspectRatio()
}
