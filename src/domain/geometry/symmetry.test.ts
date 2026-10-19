import { describe, expect, it } from 'vitest'
import { assignSymmetryGroups } from './symmetry'
import type { Point } from './symmetry'

// A D3 (triangle-like) test fixture: 6 points arranged around a center
// at 60-degree intervals, radius 1 — a generic orbit of size 6 under a
// 3-fold dihedral group.
const CENTER: Point = { x: 0, y: 0 }

function pointAtAngle(degrees: number, radius = 1): Point {
	const radians = (degrees * Math.PI) / 180
	return { x: radius * Math.cos(radians), y: radius * Math.sin(radians) }
}

describe('assignSymmetryGroups', () => {
	it('groups a generic point into one orbit of size 2*fold under a dihedral group', () => {
		// The full orbit of a single off-axis point (10 degrees) under a
		// 3-fold dihedral group with mirror axes at 0/60/120 degrees:
		// 3 rotations and 3 reflections, all distinct.
		const points = [10, 110, 130, 230, 250, 350].map(a => pointAtAngle(a))
		const assignments = assignSymmetryGroups(
			points,
			{ center: CENTER, fold: 3, mirror: true },
			point => point.y > 0 && point.x > 0,
		)

		const groupIds = new Set(assignments.map(a => a.groupId))
		expect(groupIds.size).toBe(1)
		expect(assignments.filter(a => a.isClickable)).toHaveLength(1)
		// The only point satisfying isCanonical (first quadrant, 10 degrees).
		expect(assignments[0].isClickable).toBe(true)
	})

	it('groups points on a mirror axis into a smaller orbit (size = fold)', () => {
		// Only on the 3 mirror axes of a 3-fold dihedral group starting
		// at angle 0.
		const points = [0, 120, 240].map(a => pointAtAngle(a))
		const assignments = assignSymmetryGroups(
			points,
			{ center: CENTER, fold: 3, mirror: true },
			point => point.y === 0 && point.x > 0,
		)

		expect(new Set(assignments.map(a => a.groupId)).size).toBe(1)
		expect(assignments.filter(a => a.isClickable)).toHaveLength(1)
	})

	it('treats the center point as its own clickable singleton orbit', () => {
		const points = [
			CENTER,
			...[0, 60, 120, 180, 240, 300].map(a => pointAtAngle(a)),
		]
		const assignments = assignSymmetryGroups(
			points,
			{ center: CENTER, fold: 3, mirror: true },
			point => point.y === 0 && point.x > 0,
		)

		expect(assignments[0]).toEqual({ groupId: '0', isClickable: true })
	})

	it('produces separate (non-mirrored) orbits of size `fold` for a rotation-only group', () => {
		const points = [0, 60, 120, 180, 240, 300].map(a => pointAtAngle(a))
		const assignments = assignSymmetryGroups(
			points,
			{ center: CENTER, fold: 3, mirror: false },
			point => point.y === 0 && point.x > 0,
		)

		// With no mirror, rotating by 120 degrees 3 times only reaches
		// every other point, splitting the 6 points into 2 orbits of 3.
		const groupIds = assignments.map(a => a.groupId)
		expect(new Set(groupIds).size).toBe(2)
		expect(assignments.filter(a => a.isClickable)).toHaveLength(2)
	})

	it('keeps every point assigned to exactly one group', () => {
		const points = [0, 60, 120, 180, 240, 300].map(a => pointAtAngle(a))
		const assignments = assignSymmetryGroups(
			points,
			{
				center: CENTER,
				fold: 6,
				mirror: true,
				mirrorAxisAngle: Math.PI / 2,
			},
			point => point.y > 0,
		)

		expect(assignments).toHaveLength(points.length)
		for (const assignment of assignments) {
			expect(assignment.groupId).toBeDefined()
		}
	})
})
