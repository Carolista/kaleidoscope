import { describe, expect, it } from 'vitest'
import {
	PINWHEEL_COL_STEPS,
	PINWHEEL_ROW_STEPS,
	computeGridAspectRatio,
	generatePinwheelCells,
	getGroupIds,
	groupPinwheelCells,
} from './pinwheelGrid'

describe('generatePinwheelCells', () => {
	const cells = generatePinwheelCells()

	it('generates 8 * rowSteps * colSteps cells at the default grid size', () => {
		expect(PINWHEEL_ROW_STEPS).toBe(3)
		expect(PINWHEEL_COL_STEPS).toBe(3)
		expect(cells).toHaveLength(8 * 3 * 3)
	})

	it('produces rowSteps * colSteps symmetry groups (9 at the default grid size), each of orbit size 8 (rotation only, no mirror pairing)', () => {
		const groups = groupPinwheelCells(cells)
		expect(groups.size).toBe(9)
		for (const members of groups.values()) {
			expect(members).toHaveLength(8)
		}
	})

	it('marks exactly one cell per group as clickable', () => {
		const groups = groupPinwheelCells(cells)
		for (const members of groups.values()) {
			const clickable = members.filter(cell => cell.isClickable)
			expect(clickable).toHaveLength(1)
		}
	})

	it('every clickable cell comes from transform 0 (the pinwheel\'s own "up" spoke)', () => {
		const clickable = cells.filter(cell => cell.isClickable)
		expect(clickable).toHaveLength(9)
		expect(clickable.every(cell => cell.transformIndex === 0)).toBe(true)
	})

	it('scales to a different step split (8 * rowSteps * colSteps cells, rowSteps*colSteps groups)', () => {
		const small = generatePinwheelCells(2, 3)
		expect(small).toHaveLength(8 * 2 * 3)
		expect(groupPinwheelCells(small).size).toBe(6)
	})
})

describe('getGroupIds', () => {
	it('returns one id per symmetry group (9 at the default grid size), matching groupPinwheelCells', () => {
		const ids = getGroupIds()
		expect(ids).toHaveLength(9)
		expect(new Set(ids)).toEqual(
			new Set(groupPinwheelCells(generatePinwheelCells()).keys()),
		)
	})
})

describe('computeGridAspectRatio', () => {
	it('is 1 (a square bounding box): any shape with 8-fold rotational symmetry is invariant under a 90-degree rotation, so its bounding box must be square', () => {
		expect(computeGridAspectRatio()).toBeCloseTo(1, 4)
	})

	it('returns the same ratio regardless of the rowSteps/colSteps split (a uniform scale factor cancels out, and 8-fold rotational symmetry keeps the bounding box square either way)', () => {
		expect(computeGridAspectRatio(2, 3)).toBeCloseTo(
			computeGridAspectRatio(),
			10,
		)
	})
})
