import type { Point } from './point'

// A vertex average, not an area-weighted centroid for arbitrary polygons.
export function averagePoint(points: readonly Point[]): Point {
	if (points.length === 0) {
		throw new Error('Cannot average an empty set of points')
	}
	const sum = points.reduce(
		(acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
		{ x: 0, y: 0 },
	)
	return { x: sum.x / points.length, y: sum.y / points.length }
}

export interface Circle {
	readonly x: number
	readonly y: number
	readonly radius: number
}

function circleFromTwo(a: Point, b: Point): Circle {
	return {
		x: (a.x + b.x) / 2,
		y: (a.y + b.y) / 2,
		radius: Math.hypot(a.x - b.x, a.y - b.y) / 2,
	}
}

function circleFromThree(a: Point, b: Point, c: Point): Circle {
	const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
	// Collinear points: the widest pair already spans them.
	if (Math.abs(d) < 1e-12) {
		return [
			circleFromTwo(a, b),
			circleFromTwo(a, c),
			circleFromTwo(b, c),
		].sort((p, q) => q.radius - p.radius)[0]
	}
	const aa = a.x * a.x + a.y * a.y
	const bb = b.x * b.x + b.y * b.y
	const cc = c.x * c.x + c.y * c.y
	const x = (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d
	const y = (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d
	return { x, y, radius: Math.hypot(a.x - x, a.y - y) }
}

function circleHolds(circle: Circle, point: Point): boolean {
	return (
		Math.hypot(point.x - circle.x, point.y - circle.y) <=
		circle.radius + 1e-9
	)
}

// The smallest circle holding every point. Exact, by the incremental method;
// the point sets here (a few tiles' corners) are small.
export function enclosingCircle(points: readonly Point[]): Circle {
	if (points.length === 0) {
		throw new Error('Cannot enclose an empty set of points')
	}
	let circle: Circle = { x: points[0].x, y: points[0].y, radius: 0 }
	for (let i = 1; i < points.length; i++) {
		if (circleHolds(circle, points[i])) continue
		circle = { x: points[i].x, y: points[i].y, radius: 0 }
		for (let j = 0; j < i; j++) {
			if (circleHolds(circle, points[j])) continue
			circle = circleFromTwo(points[i], points[j])
			for (let k = 0; k < j; k++) {
				if (circleHolds(circle, points[k])) continue
				circle = circleFromThree(points[i], points[j], points[k])
			}
		}
	}
	return circle
}

export function polygonBoundingBox(polygons: readonly (readonly Point[])[]): {
	minX: number
	minY: number
	maxX: number
	maxY: number
} {
	let minX = Infinity
	let minY = Infinity
	let maxX = -Infinity
	let maxY = -Infinity
	for (const polygon of polygons) {
		for (const { x, y } of polygon) {
			minX = Math.min(minX, x)
			minY = Math.min(minY, y)
			maxX = Math.max(maxX, x)
			maxY = Math.max(maxY, y)
		}
	}
	return { minX, minY, maxX, maxY }
}
