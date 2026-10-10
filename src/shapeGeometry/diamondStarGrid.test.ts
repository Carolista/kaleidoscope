import { describe, expect, it } from 'vitest'
import {
	DIAMOND_STAR_GRID_SIZE,
	computeGridAspectRatio,
	generateDiamondStarCells,
	getGroupIds,
	groupDiamondStarCells,
} from './diamondStarGrid'

describe('generateDiamondStarCells', () => {
	const cells = generateDiamondStarCells()

	it('generates 6 * gridSize^2 cells at the default grid size', () => {
		expect(DIAMOND_STAR_GRID_SIZE).toBe(4)
		expect(cells).toHaveLength(6 * 16)
	})

	it('produces gridSize * (gridSize + 1) / 2 symmetry groups (10 at the default grid size): gridSize on-axis groups of orbit size 6, the rest of orbit size 12', () => {
		const groups = groupDiamondStarCells(cells)
		expect(groups.size).toBe(10)

		const sizesByCount = new Map<number, number>()
		for (const members of groups.values()) {
			sizesByCount.set(
				members.length,
				(sizesByCount.get(members.length) ?? 0) + 1,
			)
		}

		expect(sizesByCount.get(6)).toBe(4)
		expect(sizesByCount.get(12)).toBe(6)
	})

	it('marks exactly one cell per group as clickable', () => {
		const groups = groupDiamondStarCells(cells)
		for (const members of groups.values()) {
			const clickable = members.filter(cell => cell.isClickable)
			expect(clickable).toHaveLength(1)
		}
	})

	it('every clickable cell comes from transform 0 (the star\'s own "up" diamond point)', () => {
		const clickable = cells.filter(cell => cell.isClickable)
		expect(clickable).toHaveLength(10)
		expect(clickable.every(cell => cell.transformIndex === 0)).toBe(true)
	})

	it('scales to a smaller grid size (6 * gridSize^2 cells, gridSize*(gridSize+1)/2 groups)', () => {
		const small = generateDiamondStarCells(3)
		expect(small).toHaveLength(6 * 9)
		expect(groupDiamondStarCells(small).size).toBe(6)
	})
})

describe('getGroupIds', () => {
	it('returns one id per symmetry group (10 at the default grid size), matching groupDiamondStarCells', () => {
		const ids = getGroupIds()
		expect(ids).toHaveLength(10)
		expect(new Set(ids)).toEqual(
			new Set(groupDiamondStarCells(generateDiamondStarCells()).keys()),
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
