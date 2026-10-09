import type { GridShapeId } from '../types/gridShape'
import {
	computeGridAspectRatio as computeCircleRingsAspectRatio,
	getGroupIds as getCircleRingsGroupIds,
} from './circleRingsGrid'
import {
	computeGridAspectRatio as computeDiamondStarAspectRatio,
	getGroupIds as getDiamondStarGroupIds,
} from './diamondStarGrid'
import {
	computeGridAspectRatio as computeHexagramAspectRatio,
	getGroupIds as getHexagramGroupIds,
} from './hexagramGrid'
import {
	computeGridAspectRatio as computeHexagonAspectRatio,
	getGroupIds as getHexagonGroupIds,
} from './hexagonGrid'
import {
	computeGridAspectRatio as computeTriangleAspectRatio,
	getGroupIds as getTriangleGroupIds,
} from './triangleGrid'

// Small dispatch layer so callers that need a shape's group ids or aspect
// ratio (the design randomizer, the save-image preview) don't need to
// know which shape is current themselves — they just ask for the
// current `gridShape`.
export function getGroupIdsForShape(shape: GridShapeId): string[] {
	switch (shape) {
		case 'hexagon':
			return getHexagonGroupIds()
		case 'triangle':
			return getTriangleGroupIds()
		case 'diamondStar':
			return getDiamondStarGroupIds()
		case 'hexagram':
			return getHexagramGroupIds()
		case 'circleRings':
			return getCircleRingsGroupIds()
	}
}

export function computeAspectRatioForShape(shape: GridShapeId): number {
	switch (shape) {
		case 'hexagon':
			return computeHexagonAspectRatio()
		case 'triangle':
			return computeTriangleAspectRatio()
		case 'diamondStar':
			return computeDiamondStarAspectRatio()
		case 'hexagram':
			return computeHexagramAspectRatio()
		case 'circleRings':
			return computeCircleRingsAspectRatio()
	}
}
