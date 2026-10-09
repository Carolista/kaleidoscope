import type { GridShapeId } from '../types/gridShape'
import {
	computeGridAspectRatio as computeDiamondStarAspectRatio,
	getGroupIds as getDiamondStarGroupIds,
} from './diamondStarGrid'
import {
	computeGridAspectRatio as computeHexagramAspectRatio,
	getGroupIds as getHexagramGroupIds,
} from './hexagramGrid'
import {
	computeGridAspectRatio as computeHexAspectRatio,
	getGroupIds as getHexGroupIds,
} from './hexGrid'
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
			return getHexGroupIds()
		case 'triangle':
			return getTriangleGroupIds()
		case 'diamondStar':
			return getDiamondStarGroupIds()
		case 'hexagram':
			return getHexagramGroupIds()
	}
}

export function computeAspectRatioForShape(shape: GridShapeId): number {
	switch (shape) {
		case 'hexagon':
			return computeHexAspectRatio()
		case 'triangle':
			return computeTriangleAspectRatio()
		case 'diamondStar':
			return computeDiamondStarAspectRatio()
		case 'hexagram':
			return computeHexagramAspectRatio()
	}
}
