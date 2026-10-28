import { describe, expect, it } from 'vitest'
import {
	coverPolygons,
	createOccupancyGrid,
	distanceToCovered,
	pointInPolygon,
} from './occupancyGrid'

const square = [
	{ x: 0, y: 0 },
	{ x: 10, y: 0 },
	{ x: 10, y: 10 },
	{ x: 0, y: 10 },
]

describe('pointInPolygon', () => {
	it('tells inside from outside, including concave shapes', () => {
		expect(pointInPolygon(5, 5, square)).toBe(true)
		expect(pointInPolygon(11, 5, square)).toBe(false)
		const arrow = [
			{ x: 0, y: 0 },
			{ x: 10, y: 5 },
			{ x: 0, y: 10 },
			{ x: 4, y: 5 },
		]
		expect(pointInPolygon(2, 5, arrow)).toBe(false)
		expect(pointInPolygon(1.5, 1, arrow)).toBe(true)
	})
})

describe('occupancy grid', () => {
	it('covers cells whose centers lie inside a moved polygon', () => {
		const grid = createOccupancyGrid(40, 40, 2)
		coverPolygons(grid, [square], 20, 10)
		const covered = (x: number, y: number) =>
			grid.cells[Math.floor(y / 2) * grid.cols + Math.floor(x / 2)]
		expect(covered(25, 15)).toBe(1)
		expect(covered(5, 15)).toBe(0)
		expect(covered(25, 5)).toBe(0)
	})

	it('measures straight-line distance to the nearest covered cell', () => {
		const grid = createOccupancyGrid(40, 40, 1)
		coverPolygons(grid, [square])
		const distance = distanceToCovered(grid)
		const at = (x: number, y: number) => distance[y * grid.cols + x]
		expect(at(5, 5)).toBe(0)
		// 10 columns right of the covered square's last column center (9.5).
		expect(at(19, 5)).toBeCloseTo(10)
		// Diagonal off the corner: the nearest covered center is (9.5, 9.5).
		expect(at(19, 19)).toBeCloseTo(Math.hypot(10, 10))
	})

	it('reports a large distance when nothing is covered', () => {
		const grid = createOccupancyGrid(20, 20, 1)
		expect(distanceToCovered(grid)[0]).toBeGreaterThan(1e6)
	})
})
