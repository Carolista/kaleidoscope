import { describe, expect, it } from 'vitest'
import {
	HEXAGON_GRID_RADIUS,
	HEXAGON_GRID_RADII,
	computeGridAspectRatio,
	generateHexagonCells,
	getGroupIds,
	groupHexagonCells,
} from './hexagonGrid'

describe('generateHexagonCells', () => {
	const cells = generateHexagonCells()

	it('generates the medium grid (radius 4) by default', () => {
		expect(HEXAGON_GRID_RADIUS).toBe(4)
		expect(cells).toHaveLength(61)
	})

	it('groups every cell into exactly one mirror-symmetry group', () => {
		const groups = groupHexagonCells(cells)
		expect(groups.size).toBe(getGroupIds().length)

		expect([...groups.values()].flat()).toHaveLength(cells.length)
	})

	it('marks exactly one cell per group as clickable', () => {
		const groups = groupHexagonCells(cells)
		for (const members of groups.values()) {
			const clickable = members.filter(cell => cell.isClickable)
			expect(clickable).toHaveLength(1)
		}
	})

	it('treats the center cell as its own singleton group', () => {
		const center = cells.find(cell => cell.q === 0 && cell.r === 0)
		expect(center).toBeDefined()
		expect(center!.isClickable).toBe(true)
		expect(groupHexagonCells(cells).get(center!.groupId)).toHaveLength(1)
	})

	it('scales to a smaller radius using the centered-hexagonal-number formula (1 + 3N(N+1))', () => {
		const radius = 2
		const small = generateHexagonCells(radius)
		expect(small).toHaveLength(1 + 3 * radius * (radius + 1))
	})

	it.each(Object.entries(HEXAGON_GRID_RADII))(
		'generates the %s grid size at radius %s',
		(_size, radius) => {
			expect(generateHexagonCells(radius)).toHaveLength(
				1 + 3 * radius * (radius + 1),
			)
			expect(getGroupIds(radius)).toHaveLength(
				groupHexagonCells(generateHexagonCells(radius)).size,
			)
		},
	)
})

describe('getGroupIds', () => {
	it('returns one id per mirror-symmetry group, matching groupHexagonCells', () => {
		const ids = getGroupIds()
		expect(new Set(ids)).toEqual(
			new Set(groupHexagonCells(generateHexagonCells()).keys()),
		)
	})
})

describe('computeGridAspectRatio', () => {
	it('matches the known (width / height) ratio of the default flat-top grid', () => {
		expect(computeGridAspectRatio()).toBeCloseTo(0.8829, 4)
	})

	it('returns a positive, finite ratio for other radii', () => {
		const ratio = computeGridAspectRatio(3)
		expect(ratio).toBeGreaterThan(0)
		expect(Number.isFinite(ratio)).toBe(true)
	})
})
