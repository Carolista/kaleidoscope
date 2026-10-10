import type { Point } from '../types/geometry'

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
