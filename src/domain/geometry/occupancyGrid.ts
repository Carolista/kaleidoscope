import type { Point } from './point'

export function pointInPolygon(
	x: number,
	y: number,
	polygon: readonly Point[],
): boolean {
	let inside = false
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const a = polygon[i]
		const b = polygon[j]
		if (
			a.y > y !== b.y > y &&
			x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
		)
			inside = !inside
	}
	return inside
}

// A coarse grid of cells, each either covered or empty, for asking how far a
// spot is from anything covered.
export interface OccupancyGrid {
	readonly cols: number
	readonly rows: number
	// Cell edge length in the units the polygons were given in.
	readonly step: number
	readonly cells: Uint8Array
}

export function createOccupancyGrid(
	width: number,
	height: number,
	step: number,
): OccupancyGrid {
	const cols = Math.ceil(width / step)
	const rows = Math.ceil(height / step)
	return { cols, rows, step, cells: new Uint8Array(cols * rows) }
}

// Covers every cell whose center is inside a polygon, after moving the polygons
// by (dx, dy). Edges are only as exact as the cell size.
export function coverPolygons(
	grid: OccupancyGrid,
	polygons: readonly (readonly Point[])[],
	dx = 0,
	dy = 0,
): void {
	const { cols, rows, step, cells } = grid
	for (const polygon of polygons) {
		const moved = polygon.map(point => ({
			x: point.x + dx,
			y: point.y + dy,
		}))
		const ys = moved.map(point => point.y)
		const xs = moved.map(point => point.x)
		const firstRow = Math.max(0, Math.floor(Math.min(...ys) / step))
		const lastRow = Math.min(rows - 1, Math.ceil(Math.max(...ys) / step))
		const firstCol = Math.max(0, Math.floor(Math.min(...xs) / step))
		const lastCol = Math.min(cols - 1, Math.ceil(Math.max(...xs) / step))
		for (let row = firstRow; row <= lastRow; row++)
			for (let col = firstCol; col <= lastCol; col++)
				if (
					pointInPolygon(
						(col + 0.5) * step,
						(row + 0.5) * step,
						moved,
					)
				)
					cells[row * cols + col] = 1
	}
}

const FAR = 1e20

// One pass of the exact squared-distance transform (Felzenszwalb and
// Huttenlocher) along a line of n values.
function transformLine(
	values: Float64Array,
	n: number,
	out: Float64Array,
	parabolas: Int32Array,
	bounds: Float64Array,
): void {
	let k = 0
	parabolas[0] = 0
	bounds[0] = -FAR
	bounds[1] = FAR
	for (let q = 1; q < n; q++) {
		let s: number
		for (;;) {
			const p = parabolas[k]
			s = (values[q] + q * q - (values[p] + p * p)) / (2 * q - 2 * p)
			if (s > bounds[k]) break
			k--
		}
		k++
		parabolas[k] = q
		bounds[k] = s
		bounds[k + 1] = FAR
	}
	k = 0
	for (let q = 0; q < n; q++) {
		while (bounds[k + 1] < q) k++
		const p = parabolas[k]
		out[q] = (q - p) * (q - p) + values[p]
	}
}

// For each cell, the straight-line distance (in polygon units) from its center
// to the center of the nearest covered cell. Large everywhere when nothing is covered.
export function distanceToCovered(grid: OccupancyGrid): Float64Array {
	const { cols, rows, step, cells } = grid
	const squared = new Float64Array(cols * rows)
	for (let i = 0; i < squared.length; i++) squared[i] = cells[i] ? 0 : FAR
	const longest = Math.max(cols, rows)
	const line = new Float64Array(longest)
	const out = new Float64Array(longest)
	const parabolas = new Int32Array(longest)
	const bounds = new Float64Array(longest + 1)
	for (let col = 0; col < cols; col++) {
		for (let row = 0; row < rows; row++)
			line[row] = squared[row * cols + col]
		transformLine(line, rows, out, parabolas, bounds)
		for (let row = 0; row < rows; row++)
			squared[row * cols + col] = out[row]
	}
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++)
			line[col] = squared[row * cols + col]
		transformLine(line, cols, out, parabolas, bounds)
		for (let col = 0; col < cols; col++)
			squared[row * cols + col] = out[col]
	}
	for (let i = 0; i < squared.length; i++)
		squared[i] = Math.sqrt(squared[i]) * step
	return squared
}
