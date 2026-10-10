import { describe, expect, it } from 'vitest'
import {
	TRIANGLE_GRID_SIZE,
	computeGridAspectRatio,
	generateTriangleCells,
	getGroupIds,
	groupTriangleCells,
} from './triangleGrid'

describe('generateTriangleCells', () => {
	const cells = generateTriangleCells()

	it('generates gridSize^2 cells at the default grid size', () => {
		expect(TRIANGLE_GRID_SIZE).toBe(10)
		expect(cells).toHaveLength(100)
	})

	it('produces the expected mirror-group orbit sizes at the default grid size (1 center, 9 threes, 12 sixes)', () => {
		const groups = groupTriangleCells(cells)
		expect(groups.size).toBe(22)

		const sizesByCount = new Map<number, number>()
		for (const members of groups.values()) {
			sizesByCount.set(
				members.length,
				(sizesByCount.get(members.length) ?? 0) + 1,
			)
		}

		expect(sizesByCount.get(1)).toBe(1)
		expect(sizesByCount.get(3)).toBe(9)
		expect(sizesByCount.get(6)).toBe(12)
	})

	it('marks exactly one cell per group as clickable', () => {
		const groups = groupTriangleCells(cells)
		for (const members of groups.values()) {
			const clickable = members.filter(cell => cell.isClickable)
			expect(clickable).toHaveLength(1)
		}
	})

	it('scales to a smaller grid size (gridSize^2 cells total)', () => {
		const small = generateTriangleCells(4)
		expect(small).toHaveLength(16)
	})
})

describe('getGroupIds', () => {
	it('returns one id per mirror-symmetry group (22 at the default grid size), matching groupTriangleCells', () => {
		const ids = getGroupIds()
		expect(ids).toHaveLength(22)
		expect(new Set(ids)).toEqual(
			new Set(groupTriangleCells(generateTriangleCells()).keys()),
		)
	})
})

describe('computeGridAspectRatio', () => {
	it('matches the known (width / height) ratio of an equilateral triangle (2 / sqrt(3))', () => {
		expect(computeGridAspectRatio()).toBeCloseTo(2 / Math.sqrt(3), 4)
	})

	it('returns the same ratio regardless of grid size (a uniform scale factor cancels out)', () => {
		expect(computeGridAspectRatio(4)).toBeCloseTo(
			computeGridAspectRatio(),
			10,
		)
	})
})
