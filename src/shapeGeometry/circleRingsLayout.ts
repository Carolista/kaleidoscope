import type { Point } from '../types/geometry'
import type { CircleRingsCell } from '../types/circleRings'

export interface CircleRingsLayout {
	// Number of rings surrounding the center dot.
	readonly ringCount: number
	// Diameter of the center dot and ring 1's circles, in SVG user
	// units — the smallest circles in the design. Chosen (together with
	// CircleRingsGrid.tsx's on-screen scale) so this maps to a minimum
	// comfortable touch target (~30px) at the grid's maximum rendered
	// width; every ring beyond ring 1 grows from this floor (see
	// GROWTH_STEP_RATIO below).
	readonly size: number
}

// Each ring `n >= 2`'s circles grow by this fraction of the floor
// diameter (`layout.size`) per ring step, so ring `n`'s diameter is
// `size + (n - 1) * size * GROWTH_STEP_RATIO`. Expressing growth as a
// fraction of `size` (rather than a fixed constant) keeps growth
// proportional if the floor size itself is ever tuned.
export const GROWTH_STEP_RATIO = 1 / 12

// Multiplier (slightly over 1) applied to the minimum spacing required
// both between neighboring circles within the same ring and between
// consecutive rings, so circles never quite touch. Kept close to 1 (the
// bare "just touching" case) per "rings can be close together", while
// still leaving a visible gap between circles.
export const RING_GAP = 1.04

// Number of circles evenly spaced around ring `n` — a multiple of 6 (one
// per each of the shape's 6 rotational spokes) that grows with the
// ring's own circumference, so outer rings stay just as evenly spaced as
// inner ones instead of thinning out.
export function circleCountForRing(ring: number): number {
	return 6 * ring
}

// Diameter of ring `n`'s circles (or the center dot's, for ring 0) — the
// floor diameter for rings 0 and 1, growing from there (see
// GROWTH_STEP_RATIO) so the design satisfies "the innermost circle
// should be the smallest, and with each ring they should increase in
// diameter" while still respecting the minimum touch-target size.
export function circleRingsCellDiameter(
	ring: number,
	layout: CircleRingsLayout,
): number {
	if (ring <= 1) return layout.size
	return layout.size + (ring - 1) * layout.size * GROWTH_STEP_RATIO
}

// The radial distance from the shape's center to the middle of ring
// `n`'s circles. Computed iteratively ring-by-ring (rather than a closed
// formula) since each ring's radius is the larger of two constraints:
// far enough out that its own `6n` evenly-spaced circles don't overlap
// each other, and far enough from the previous ring that the two rings'
// circles don't overlap either.
export function ringCenterRadius(
	ring: number,
	layout: CircleRingsLayout,
): number {
	if (ring === 0) return 0

	let radius = 0
	// Ring 0 (the center dot) shares ring 1's floor diameter.
	let previousDiameter = layout.size
	for (let n = 1; n <= ring; n++) {
		const diameter = circleRingsCellDiameter(n, layout)
		const count = circleCountForRing(n)
		// Chord between two of this ring's own neighboring circles is
		// `2 * radius * sin(pi / count)`; solving that for `radius` at
		// the no-overlap threshold (chord == diameter * RING_GAP) gives
		// the minimum radius this ring can sit at.
		const sameRingMin =
			(diameter * RING_GAP) / (2 * Math.sin(Math.PI / count))
		const radialMin =
			radius + ((previousDiameter + diameter) / 2) * RING_GAP
		radius = Math.max(sameRingMin, radialMin)
		previousDiameter = diameter
	}
	return radius
}

export function circleRingsCellRadius(
	cell: Pick<CircleRingsCell, 'ring'>,
	layout: CircleRingsLayout,
): number {
	return circleRingsCellDiameter(cell.ring, layout) / 2
}

// A cell's on-screen center point: the shape's own center for the lone
// ring-0 dot, otherwise a point on ring `cell.ring`'s circle, spaced
// evenly starting from straight up (`-90` degrees) to match the other
// shapes' "up" spoke convention.
export function circleRingsCellCenter(
	cell: Pick<CircleRingsCell, 'ring' | 'index'>,
	layout: CircleRingsLayout,
): Point {
	if (cell.ring === 0) return { x: 0, y: 0 }

	const count = circleCountForRing(cell.ring)
	const angle = (-90 + (cell.index * 360) / count) * (Math.PI / 180)
	const radius = ringCenterRadius(cell.ring, layout)
	return {
		x: radius * Math.cos(angle),
		y: radius * Math.sin(angle),
	}
}

export function circleRingsBoundingBox(
	circles: readonly { readonly center: Point; readonly radius: number }[],
): { minX: number; minY: number; maxX: number; maxY: number } {
	let minX = Infinity
	let minY = Infinity
	let maxX = -Infinity
	let maxY = -Infinity
	for (const { center, radius } of circles) {
		minX = Math.min(minX, center.x - radius)
		minY = Math.min(minY, center.y - radius)
		maxX = Math.max(maxX, center.x + radius)
		maxY = Math.max(maxY, center.y + radius)
	}
	return { minX, minY, maxX, maxY }
}
