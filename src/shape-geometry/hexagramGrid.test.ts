import { describe, expect, it } from 'vitest'
import {
	HEXAGRAM_GRID_SIZE,
	computeGridAspectRatio,
	generateHexagramCells,
	getGroupIds,
	groupHexagramCells,
} from './hexagramGrid'

describe('generateHexagramCells', () => {
	const cells = generateHexagramCells()

	it('generates 12 * gridSize^2 cells at the default grid size (2 equilateral triangles per spoke, 6 spokes)', () => {
		expect(HEXAGRAM_GRID_SIZE).toBe(4)
		expect(cells).toHaveLength(12 * 16)
	})

	it('produces gridSize * (gridSize + 1) symmetry groups (20 at the default grid size): 2 * gridSize on-axis groups of orbit size 6, the rest of orbit size 12', () => {
		const groups = groupHexagramCells(cells)
		expect(groups.size).toBe(20)

		const sizesByCount = new Map<number, number>()
		for (const members of groups.values()) {
			sizesByCount.set(
				members.length,
				(sizesByCount.get(members.length) ?? 0) + 1,
			)
		}

		expect(sizesByCount.get(6)).toBe(8)
		expect(sizesByCount.get(12)).toBe(12)
	})

	it('marks exactly one cell per group as clickable', () => {
		const groups = groupHexagramCells(cells)
		for (const members of groups.values()) {
			const clickable = members.filter(cell => cell.isClickable)
			expect(clickable).toHaveLength(1)
		}
	})

	it('every clickable cell comes from transform 0 (the star\'s own "up" spoke)', () => {
		const clickable = cells.filter(cell => cell.isClickable)
		expect(clickable).toHaveLength(20)
		expect(clickable.every(cell => cell.transformIndex === 0)).toBe(true)
	})

	it('scales to a smaller grid size (12 * gridSize^2 cells, gridSize*(gridSize+1) groups)', () => {
		const small = generateHexagramCells(3)
		expect(small).toHaveLength(12 * 9)
		expect(groupHexagramCells(small).size).toBe(12)
	})
})

describe('getGroupIds', () => {
	it('returns one id per symmetry group (20 at the default grid size), matching groupHexagramCells', () => {
		const ids = getGroupIds()
		expect(ids).toHaveLength(20)
		expect(new Set(ids)).toEqual(
			new Set(groupHexagramCells(generateHexagramCells()).keys()),
		)
	})
})

describe('computeGridAspectRatio', () => {
	it('matches the known (width / height) ratio of this 6-point star (sqrt(3) / 2, slightly taller than wide)', () => {
		expect(computeGridAspectRatio()).toBeCloseTo(Math.sqrt(3) / 2, 4)
	})

	it('returns the same ratio regardless of grid size (a uniform scale factor cancels out)', () => {
		expect(computeGridAspectRatio(3)).toBeCloseTo(
			computeGridAspectRatio(),
			10,
		)
	})
})
