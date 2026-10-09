import type { Point } from '../types/geometry'

export type { Point }

export interface SymmetryGroupOptions {
	// Center of rotation/reflection, in the same coordinate space as the
	// points passed to `assignSymmetryGroups`.
	readonly center: Point
	// Rotational fold of the symmetry (e.g. 3 for a plain triangle, 6 for
	// a hexagon or 6-point star).
	readonly fold: number
	// Whether the shape also has mirror symmetry (dihedral group D_fold,
	// like today's hexagon) or is rotation-only (cyclic group C_fold, a
	// deliberately asymmetric/"pinwheel" look).
	readonly mirror: boolean
	// Angle (radians, standard atan2 convention: 0 along +x, increasing
	// toward +y) of one mirror axis through `center`. Required when
	// `mirror` is true; ignored otherwise.
	readonly mirrorAxisAngle?: number
}

export interface SymmetryAssignment {
	readonly groupId: string
	readonly isClickable: boolean
}

// Rounds a coordinate to a fixed precision so that floating-point
// rotation/reflection results reliably match the point they came from,
// despite trig's accumulated rounding error.
const PRECISION = 1e-6

function keyFor(point: Point): string {
	const round = (n: number) => Math.round(n / PRECISION)
	return `${round(point.x)},${round(point.y)}`
}

export function rotate(point: Point, center: Point, angle: number): Point {
	const dx = point.x - center.x
	const dy = point.y - center.y
	const cos = Math.cos(angle)
	const sin = Math.sin(angle)
	return {
		x: center.x + dx * cos - dy * sin,
		y: center.y + dx * sin + dy * cos,
	}
}

// Reflects `point` across the line through `center` at angle `axisAngle`.
export function reflect(point: Point, center: Point, axisAngle: number): Point {
	const dx = point.x - center.x
	const dy = point.y - center.y
	const cos2 = Math.cos(2 * axisAngle)
	const sin2 = Math.sin(2 * axisAngle)
	return {
		x: center.x + dx * cos2 + dy * sin2,
		y: center.y + dx * sin2 - dy * cos2,
	}
}

// Builds the full set of symmetry transforms: `fold` rotations, plus (for
// a dihedral group) `fold` more mirror reflections across axes spaced
// evenly (pi / fold apart) starting at `mirrorAxisAngle`.
function buildTransforms(
	options: SymmetryGroupOptions,
): ((point: Point) => Point)[] {
	const { center, fold, mirror, mirrorAxisAngle = 0 } = options
	const transforms: ((point: Point) => Point)[] = []

	for (let k = 0; k < fold; k++) {
		const angle = (2 * Math.PI * k) / fold
		transforms.push(point => rotate(point, center, angle))
	}

	if (mirror) {
		for (let k = 0; k < fold; k++) {
			const axisAngle = mirrorAxisAngle + (Math.PI * k) / fold
			transforms.push(point => reflect(point, center, axisAngle))
		}
	}

	return transforms
}

// Assigns every point a symmetry-group id (shared by every point in its
// orbit under the given rotation/reflection group) and whether it's that
// group's clickable representative — the one and only orbit member whose
// point satisfies `isCanonical`, the caller's test for the fundamental
// domain (the visual "wedge") that should be interactive.
//
// This computes symmetry via real geometric transforms applied to actual
// point positions (matched back to known points by rounded-coordinate
// lookup), rather than shape-specific coordinate algebra like the hex
// grid's cube-coordinate rotation trick (see hexGrid.ts) — so the same
// engine works for any shape whose cells can be identified by a single
// reference point (a centroid, typically), be it a triangle grid, a
// 6-point star, or concentric rings.
export function assignSymmetryGroups(
	points: readonly Point[],
	options: SymmetryGroupOptions,
	isCanonical: (point: Point) => boolean,
): SymmetryAssignment[] {
	const transforms = buildTransforms(options)
	const indexByKey = new Map<string, number>()
	points.forEach((point, index) => indexByKey.set(keyFor(point), index))

	const assignments: SymmetryAssignment[] = new Array(points.length)
	const visited = new Array(points.length).fill(false)

	for (let i = 0; i < points.length; i++) {
		if (visited[i]) continue

		const orbit = new Set<number>()
		for (const transform of transforms) {
			const match = indexByKey.get(keyFor(transform(points[i])))
			if (match !== undefined) orbit.add(match)
		}

		const orbitIndices = [...orbit]
		// Falls back to the orbit's first member if none satisfies
		// `isCanonical` — this only happens for a point that coincides
		// with `center` itself (its own single-member orbit), which has
		// no meaningful angle to test but is unambiguously clickable
		// since it's the only candidate.
		const canonicalIndex =
			orbitIndices.find(index => isCanonical(points[index])) ??
			orbitIndices[0]
		const groupId = String(canonicalIndex)

		for (const index of orbitIndices) {
			visited[index] = true
			assignments[index] = {
				groupId,
				isClickable: index === canonicalIndex,
			}
		}
	}

	return assignments
}
