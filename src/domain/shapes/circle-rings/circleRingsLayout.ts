import type { Point } from '@/domain/geometry'
import type { CircleRingsCell } from './circleRingsTypes'

export interface CircleRingsLayout {
	// Number of rings surrounding the center dot.
	readonly ringCount: number
	// Diameter of the center dot and ring 1's circles, in SVG user
	// units — the smallest circles in the design. Chosen (together with
	// CircleRingsGrid.tsx's on-screen scale) so this maps to a minimum
	// comfortable touch target (~30px) at the grid's maximum rendered
	// width; every ring beyond ring 1 grows from this floor (see
	// ringMetrics below).
	readonly size: number
}

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

interface RingMetrics {
	// Circle diameter as a multiple of the floor diameter (`layout.size`).
	readonly diameterRatio: number
	// Distance from the shape's center to the ring's circle centers, as a
	// multiple of the floor diameter.
	readonly radiusRatio: number
}

// Each ring's circle size is solved so ring `n`'s `6n` circles just fit,
// both around their own ring and against ring `n - 1` along the spokes
// (where both rings have a circle), with RING_GAP applied to both:
//   radius[n] - gap * diameter[n] / 2 = radius[n-1] + gap * diameter[n-1] / 2
//   diameter[n] = 2 * radius[n] * sin(pi / 6n) / gap
// which gives the closed recurrence below. Growth is whatever that allows
// (about 1.00, 1.05, 1.07, 1.09, 1.10 for rings 1-5), so every ring gap
// along a spoke equals RING_GAP's. A faster fixed growth step forced outer
// rings apart (up to 27% of a diameter at ring 5) to fit their circles.
function ringMetrics(ring: number): RingMetrics {
	if (ring <= 0) return { diameterRatio: 1, radiusRatio: 0 }

	let diameterRatio = 1
	// Ring 1's six circles touch the center dot and, at 60 degrees, each other.
	let radiusRatio = RING_GAP / (2 * Math.sin(Math.PI / 6))
	for (let n = 2; n <= ring; n++) {
		const sine = Math.sin(Math.PI / (6 * n))
		radiusRatio =
			(radiusRatio + (RING_GAP * diameterRatio) / 2) / (1 - sine)
		diameterRatio = (2 * radiusRatio * sine) / RING_GAP
	}
	return { diameterRatio, radiusRatio }
}

// Diameter of ring `n`'s circles (or the center dot's, for ring 0) — the
// floor diameter for rings 0 and 1, growing from there (see ringMetrics)
// so the design satisfies "the innermost circle should be the smallest,
// and with each ring they should increase in diameter" while still
// respecting the minimum touch-target size.
export function circleRingsCellDiameter(
	ring: number,
	layout: CircleRingsLayout,
): number {
	return layout.size * ringMetrics(ring).diameterRatio
}

// The radial distance from the shape's center to the middle of ring
// `n`'s circles.
export function ringCenterRadius(
	ring: number,
	layout: CircleRingsLayout,
): number {
	return layout.size * ringMetrics(ring).radiusRatio
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
