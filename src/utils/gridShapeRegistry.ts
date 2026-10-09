import type { GridShapeId } from '../types/gridShape'
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
// current `gridShape`. A direct switch (rather than a lookup-table
// registry) is simplest while there are only 2 shapes; revisit if a
// third shape makes this unwieldy.
export function getGroupIdsForShape(shape: GridShapeId): string[] {
	switch (shape) {
		case 'hexagon':
			return getHexGroupIds()
		case 'triangle':
			return getTriangleGroupIds()
	}
}

export function computeAspectRatioForShape(shape: GridShapeId): number {
	switch (shape) {
		case 'hexagon':
			return computeHexAspectRatio()
		case 'triangle':
			return computeTriangleAspectRatio()
	}
}
