import type { AxialCoord } from '../types/hex'

export type HexOrientation = 'flat' | 'pointy'

export interface HexLayout {
	readonly orientation: HexOrientation
	// Circumradius: distance from a hex's center to each of its 6 corners, in px.
	readonly size: number
}

export interface Point {
	readonly x: number
	readonly y: number
}

const SQRT3 = Math.sqrt(3)

export function axialToPixel({ q, r }: AxialCoord, layout: HexLayout): Point {
	const { size, orientation } = layout
	if (orientation === 'flat') {
		return {
			x: size * 1.5 * q,
			y: size * ((SQRT3 / 2) * q + SQRT3 * r),
		}
	}
	return {
		x: size * (SQRT3 * q + (SQRT3 / 2) * r),
		y: size * 1.5 * r,
	}
}

export function hexCorners(center: Point, layout: HexLayout): Point[] {
	const angleOffsetDeg = layout.orientation === 'flat' ? 0 : 30
	return Array.from({ length: 6 }, (_, i) => {
		const angleRad = (Math.PI / 180) * (60 * i + angleOffsetDeg)
		return {
			x: center.x + layout.size * Math.cos(angleRad),
			y: center.y + layout.size * Math.sin(angleRad),
		}
	})
}

export function pointsToSvgAttr(points: readonly Point[]): string {
	return points.map(p => `${p.x},${p.y}`).join(' ')
}

export function boundingBox(
	centers: readonly Point[],
	layout: HexLayout,
): {
	minX: number
	minY: number
	maxX: number
	maxY: number
} {
	const { size } = layout
	let minX = Infinity
	let minY = Infinity
	let maxX = -Infinity
	let maxY = -Infinity
	for (const { x, y } of centers) {
		minX = Math.min(minX, x - size)
		minY = Math.min(minY, y - size)
		maxX = Math.max(maxX, x + size)
		maxY = Math.max(maxY, y + size)
	}
	return { minX, minY, maxX, maxY }
}
