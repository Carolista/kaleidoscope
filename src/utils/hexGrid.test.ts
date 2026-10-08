import { describe, expect, it } from 'vitest'
import {
	HEX_GRID_RADIUS,
	computeGridAspectRatio,
	generateHexCells,
	groupHexCells,
} from './hexGrid'

describe('generateHexCells', () => {
	const cells = generateHexCells()

	it('generates 169 cells at the default radius (reduced from the original 271 for small touchscreens; see DECISIONS.md)', () => {
		expect(HEX_GRID_RADIUS).toBe(7)
		expect(cells).toHaveLength(169)
	})

	it('produces the expected mirror-group orbit sizes at the default radius (1 center, 10 sixes, 9 twelves)', () => {
		const groups = groupHexCells(cells)
		expect(groups.size).toBe(20)

		const sizesByCount = new Map<number, number>()
		for (const members of groups.values()) {
			sizesByCount.set(
				members.length,
				(sizesByCount.get(members.length) ?? 0) + 1,
			)
		}

		expect(sizesByCount.get(1)).toBe(1)
		expect(sizesByCount.get(6)).toBe(10)
		expect(sizesByCount.get(12)).toBe(9)
	})

	it('marks exactly one cell per group as clickable', () => {
		const groups = groupHexCells(cells)
		for (const members of groups.values()) {
			const clickable = members.filter(cell => cell.isClickable)
			expect(clickable).toHaveLength(1)
		}
	})

	it('treats the center cell as its own singleton group', () => {
		const center = cells.find(cell => cell.q === 0 && cell.r === 0)
		expect(center).toBeDefined()
		expect(center!.isClickable).toBe(true)
		expect(groupHexCells(cells).get(center!.groupId)).toHaveLength(1)
	})

	it('scales to a smaller radius using the centered-hexagonal-number formula (1 + 3N(N+1))', () => {
		const radius = 2
		const small = generateHexCells(radius)
		expect(small).toHaveLength(1 + 3 * radius * (radius + 1))
	})
})

describe('computeGridAspectRatio', () => {
	it('matches the known (width / height) ratio of the default flat-top grid', () => {
		expect(computeGridAspectRatio()).toBeCloseTo(0.8762, 4)
	})

	it('returns a positive, finite ratio for other radii', () => {
		const ratio = computeGridAspectRatio(3)
		expect(ratio).toBeGreaterThan(0)
		expect(Number.isFinite(ratio)).toBe(true)
	})
})
