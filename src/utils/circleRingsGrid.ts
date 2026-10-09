import type { Point } from '../types/geometry'
import type { CircleRingsCell } from '../types/circleRings'
import { assignSymmetryGroups } from './symmetry'
import {
	circleCountForRing,
	circleRingsBoundingBox,
	circleRingsCellCenter,
	circleRingsCellRadius,
} from './circleRingsLayout'
import type { CircleRingsLayout } from './circleRingsLayout'

// Number of rings surrounding the center dot. 7 rings would pack the
// outer rings' growing circle counts too tightly to keep every circle at
// a comfortable minimum touch-target size (~30px) at the grid's max
// on-screen width; 6 rings leaves enough room for a clearly visible
// size increase ring-to-ring while keeping that floor. Yields 16
// clickable groups (see circleRingsGrid.test.ts).
export const CIRCLE_RINGS_GRID_SIZE = 6

const CENTER: Point = { x: 0, y: 0 }
// A fixed, abstract layout (ring-1 bandwidth 1) used only to compute
// each circle's center for the symmetry math below — unrelated to the
// actual on-screen render size, which CircleRingsGrid.tsx supplies.
const UNIT_LAYOUT: CircleRingsLayout = { ringCount: 0, size: 1 }

interface RawCircle {
	readonly ring: number
	readonly index: number
	readonly center: Point
}

// Every circle in the shape: the lone center dot, plus `6n` evenly
// spaced circles per ring `n`, for `ringCount` rings.
function generateRawCircles(ringCount: number): RawCircle[] {
	const circles: RawCircle[] = [{ ring: 0, index: 0, center: CENTER }]
	for (let ring = 1; ring <= ringCount; ring++) {
		const count = circleCountForRing(ring)
		for (let index = 0; index < count; index++) {
			circles.push({
				ring,
				index,
				center: circleRingsCellCenter({ ring, index }, UNIT_LAYOUT),
			})
		}
	}
	return circles
}

// Picks the canonical (clickable) member of each symmetry orbit: the
// one in the 30-degree wedge from straight up (the "up" spoke,
// 270 degrees in standard atan2-from-positive-x terms) to the next
// mirror axis — matching the other shapes' convention of landing the
// clickable wedge near 11-12 o'clock. A closed [270, 300] range reliably
// picks exactly one representative per orbit, including circles that sit
// exactly on a mirror axis, and the center dot (its own single-member
// orbit, which falls back to itself regardless of angle — see
// symmetry.ts).
function isCanonicalWedge(point: Point): boolean {
	let angle =
		Math.atan2(point.y - CENTER.y, point.x - CENTER.x) * (180 / Math.PI)
	if (angle < 0) angle += 360
	return angle >= 270 && angle <= 300
}

// Generates every circle in the kaleidoscope's circle-rings shape: a
// lone center dot surrounded by `ringCount` concentric rings of
// progressively larger, more numerous circles, each tagged with its D6
// symmetry-group id and whether it's the clickable representative — the
// circle-rings counterpart of triangleGrid.ts's generateTriangleCells,
// generating the full set of circles directly (rather than one copy
// replicated by rotation, as diamondStarGrid.ts/hexagramGrid.ts do)
// since a ring's circles aren't already self-mirror-symmetric in groups
// smaller than the full ring.
export function generateCircleRingsCells(
	ringCount: number = CIRCLE_RINGS_GRID_SIZE,
): CircleRingsCell[] {
	const raw = generateRawCircles(ringCount)
	const assignments = assignSymmetryGroups(
		raw.map(circle => circle.center),
		{
			center: CENTER,
			fold: 6,
			mirror: true,
			mirrorAxisAngle: -Math.PI / 2,
		},
		isCanonicalWedge,
	)

	return raw.map((circle, index) => ({
		ring: circle.ring,
		index: circle.index,
		groupId: assignments[index].groupId,
		isClickable: assignments[index].isClickable,
	}))
}

// Preserves insertion order (a plain `Map` does), since iteration order of
// the groups matters for the clickable wedge's visual sequence.
export function groupCircleRingsCells(
	cells: readonly CircleRingsCell[],
): Map<string, CircleRingsCell[]> {
	const groups = new Map<string, CircleRingsCell[]>()
	for (const cell of cells) {
		const list = groups.get(cell.groupId)
		if (list) {
			list.push(cell)
		} else {
			groups.set(cell.groupId, [cell])
		}
	}
	return groups
}

// Every distinct symmetry group id in the grid — lets callers (e.g. the
// design randomizer) know which groups exist without needing the full
// cell list.
export function getGroupIds(
	ringCount: number = CIRCLE_RINGS_GRID_SIZE,
): string[] {
	return [
		...groupCircleRingsCells(generateCircleRingsCells(ringCount)).keys(),
	]
}

// The grid's overall (width / height) ratio — close to, but not always
// exactly, 1: the shape is circularly symmetric in principle, but each
// ring's circle count isn't always a multiple of 4, so the discrete set
// of sampled circles doesn't always reach precisely as far along the x
// axis as it does along the y axis. Computed from real geometry (rather
// than hard-coded) to stay consistent with every other shape's
// computeGridAspectRatio, and close enough to 1 that callers (the
// save-image preview's aspect-ratio box) read it as square either way.
export function computeGridAspectRatio(
	ringCount: number = CIRCLE_RINGS_GRID_SIZE,
): number {
	const raw = generateRawCircles(ringCount)
	const { minX, minY, maxX, maxY } = circleRingsBoundingBox(
		raw.map(circle => ({
			center: circle.center,
			radius: circleRingsCellRadius(circle, UNIT_LAYOUT),
		})),
	)
	return (maxX - minX) / (maxY - minY)
}
