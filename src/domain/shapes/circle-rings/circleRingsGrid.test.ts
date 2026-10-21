import { describe, expect, it } from 'vitest'
import {
	CIRCLE_RINGS_GRID_SIZE,
	CIRCLE_RINGS_GRID_SIZES,
	computeGridAspectRatio,
	generateCircleRingsCells,
	getGroupIds,
	groupCircleRingsCells,
} from './circleRingsGrid'

describe('generateCircleRingsCells', () => {
	const cells = generateCircleRingsCells()

	it('generates 1 + 6 * (1 + 2 + ... + ringCount) circles at the default ring count (the center dot plus 6n per ring n)', () => {
		expect(CIRCLE_RINGS_GRID_SIZE).toBe(5)
		expect(cells).toHaveLength(91)
	})

	it('produces 12 symmetry groups at the default ring count: the center dot (orbit size 1), 7 on-axis groups of orbit size 6, and 4 of orbit size 12', () => {
		const groups = groupCircleRingsCells(cells)
		expect(groups.size).toBe(12)

		const sizesByCount = new Map<number, number>()
		for (const members of groups.values()) {
			sizesByCount.set(
				members.length,
				(sizesByCount.get(members.length) ?? 0) + 1,
			)
		}

		expect(sizesByCount.get(1)).toBe(1)
		expect(sizesByCount.get(6)).toBe(7)
		expect(sizesByCount.get(12)).toBe(4)
	})

	it('marks exactly one cell per group as clickable', () => {
		const groups = groupCircleRingsCells(cells)
		for (const members of groups.values()) {
			const clickable = members.filter(cell => cell.isClickable)
			expect(clickable).toHaveLength(1)
		}
	})

	it('the center dot (ring 0) is always clickable, as the lone member of its own orbit', () => {
		const center = cells.find(cell => cell.ring === 0)
		expect(center?.isClickable).toBe(true)
	})

	it('scales to a smaller ring count (1 + 6 * (1 + ... + ringCount) cells)', () => {
		const small = generateCircleRingsCells(2)
		expect(small).toHaveLength(1 + 6 + 12)
		// Center dot (orbit 1), ring 1's on-axis circle (orbit 6), and
		// ring 2's one on-axis + one mirror-paired group (orbits 6 + 12).
		expect(groupCircleRingsCells(small).size).toBe(4)
	})

	it.each(Object.entries(CIRCLE_RINGS_GRID_SIZES))(
		'generates the %s grid at %s rings',
		(_size, ringCount) => {
			const sizedCells = generateCircleRingsCells(ringCount)
			expect(sizedCells).toHaveLength(1 + 3 * ringCount * (ringCount + 1))
			expect(getGroupIds(ringCount)).toHaveLength(
				groupCircleRingsCells(sizedCells).size,
			)
		},
	)
})

describe('getGroupIds', () => {
	it('returns one id per symmetry group (12 at the default ring count), matching groupCircleRingsCells', () => {
		const ids = getGroupIds()
		expect(ids).toHaveLength(12)
		expect(new Set(ids)).toEqual(
			new Set(groupCircleRingsCells(generateCircleRingsCells()).keys()),
		)
	})
})

describe('computeGridAspectRatio', () => {
	it('is very close to 1 — the shape is circularly symmetric, modulo each ring not always sampling a multiple of 4 circles', () => {
		expect(computeGridAspectRatio()).toBeCloseTo(1, 1)
	})
})
