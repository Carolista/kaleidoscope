import {
	computeGridAspectRatio as computeCircleRingsAspectRatio,
	getGroupIds as getCircleRingsGroupIds,
	CIRCLE_RINGS_GRID_SIZES,
} from './circleRingsGrid'
import {
	computeGridAspectRatio as computeDiamondStarAspectRatio,
	getGroupIds as getDiamondStarGroupIds,
	DIAMOND_STAR_GRID_SIZES,
} from './diamondStarGrid'
import {
	computeGridAspectRatio as computeHexagonAspectRatio,
	getGroupIds as getHexagonGroupIds,
	HEXAGON_GRID_RADII,
} from './hexagonGrid'
import {
	computeGridAspectRatio as computeHexagramAspectRatio,
	getGroupIds as getHexagramGroupIds,
	HEXAGRAM_GRID_SIZES,
} from './hexagramGrid'
import {
	computeGridAspectRatio as computePinwheelAspectRatio,
	getGroupIds as getPinwheelGroupIds,
	PINWHEEL_GRID_SIZES,
} from './pinwheelGrid'
import {
	computeGridAspectRatio as computeTriangleAspectRatio,
	getGroupIds as getTriangleGroupIds,
	TRIANGLE_GRID_SIZES,
} from './triangleGrid'
import { defaultGridSizes } from '@/data/gridSizes'
import type { GridShapeId } from '@/types/gridShape'
import type { GridSize } from '@/types/gridSize'

function assertNever(shape: never): never {
	throw new Error(`Unsupported grid shape: ${shape}`)
}

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
	if (shape === 'pinwheel') {
		const { rowSteps, colSteps } = PINWHEEL_GRID_SIZES[gridSize]
		return getPinwheelGroupIds(rowSteps, colSteps)
	}
	return assertNever(shape)
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
	if (shape === 'pinwheel') {
		const { rowSteps, colSteps } = PINWHEEL_GRID_SIZES[gridSize]
		return computePinwheelAspectRatio(rowSteps, colSteps)
	}
	return assertNever(shape)
}
