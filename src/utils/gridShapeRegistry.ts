import type { GridShapeId } from '../types/gridShape'
import {
	computeGridAspectRatio as computeCircleRingsAspectRatio,
	getGroupIds as getCircleRingsGroupIds,
} from '@geometry/circleRingsGrid'
import {
	computeGridAspectRatio as computeDiamondStarAspectRatio,
	getGroupIds as getDiamondStarGroupIds,
} from '@geometry/diamondStarGrid'
import {
	computeGridAspectRatio as computeHexagramAspectRatio,
	getGroupIds as getHexagramGroupIds,
} from '@geometry/hexagramGrid'
import {
	computeGridAspectRatio as computeHexagonAspectRatio,
	getGroupIds as getHexagonGroupIds,
} from '@geometry/hexagonGrid'
import {
	computeGridAspectRatio as computePinwheelAspectRatio,
	getGroupIds as getPinwheelGroupIds,
} from '@geometry/pinwheelGrid'
import {
	computeGridAspectRatio as computeTriangleAspectRatio,
	getGroupIds as getTriangleGroupIds,
} from '@geometry/triangleGrid'

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
		case 'pinwheel':
			return getPinwheelGroupIds()
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
		case 'pinwheel':
			return computePinwheelAspectRatio()
	}
}
