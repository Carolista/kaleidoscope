import { describe, expect, it } from 'vitest'
import type { PaletteGroup, PuzzleGroup } from './index'
import {
	countStates,
	otherPuzzleGroups,
	packageRelease,
	PUZZLES_PER_GROUP,
	paletteGroupIssue,
	slotReleases,
	sortPaletteGroups,
} from './releaseOverview'

const open = { published_at: null, release_at: null }
const scheduled = {
	published_at: '2026-01-01T00:00:00Z',
	release_at: '2999-01-01T00:00:00Z',
}
const live = {
	published_at: '2000-01-01T00:00:00Z',
	release_at: '2000-01-01T00:00:00Z',
}

function puzzleGroup(
	id: string,
	puzzles: number,
	release: {
		published_at: string | null
		release_at: string | null
	} = open,
	purpose: PuzzleGroup['purpose'] = 'core',
): PuzzleGroup {
	return {
		row: {
			id,
			name: `Group ${id}`,
			purpose,
			track: 'basic',
			shape_id: 'hexagon',
			selection_mode: 'any',
			...release,
		},
		purpose,
		track: 'basic',
		preview: null,
		members: Array.from({ length: puzzles }, (_, index) => ({
			puzzleId: `${id}-${index}`,
			name: `Puzzle ${index}`,
			position: index + 1,
			preview: null,
		})),
	}
}

function paletteGroup(
	id: string,
	purpose: PaletteGroup['purpose'],
	members: number,
	name = id,
): PaletteGroup {
	return {
		row: { id, name, purpose, ...open },
		purpose,
		members: Array.from({ length: members }, (_, index) => ({
			id: `${id}-${index}`,
			name: `P${index}`,
			colors: [],
		})),
	}
}

const progression = {
	groups: [
		{
			id: 'basic',
			name: 'Basic',
			purpose: 'core' as const,
			shapeId: 'hexagon',
			track: 'basic' as const,
			published: false,
		},
		{
			id: 'bonus',
			name: 'Bonus',
			purpose: 'reward' as const,
			shapeId: 'hexagon',
			track: 'basic' as const,
			published: false,
		},
	],
	rewards: [
		{ groupId: 'basic', paletteIds: ['cabo'], bonusGroupIds: ['bonus'] },
	],
}

describe('slotReleases', () => {
	it('lists the four slots in order, with empty ones marked', () => {
		const slots = slotReleases(progression, [], 'hexagon')
		expect(slots.map(slot => slot.title)).toEqual([
			'Basic',
			'Rotation',
			'Bonus Basic',
			'Bonus Rotation',
		])
		expect(slots[1]).toMatchObject({
			group: null,
			state: 'empty',
			issues: [],
		})
	})

	it('reports a ready group with its palette, bonus unlocks, and release state', () => {
		const [basic] = slotReleases(
			progression,
			[puzzleGroup('basic', PUZZLES_PER_GROUP, scheduled)],
			'hexagon',
		)
		expect(basic).toMatchObject({
			group: { id: 'basic', name: 'Basic' },
			state: 'scheduled',
			puzzleCount: 24,
			paletteId: 'cabo',
			unlocks: ['Bonus'],
			issues: [],
		})
		expect(basic.row?.id).toBe('basic')
	})

	it('flags a wrong puzzle count and a missing reward', () => {
		const slots = slotReleases(
			progression,
			[puzzleGroup('basic', 23), puzzleGroup('bonus', 24, live)],
			'hexagon',
		)
		expect(slots[0].issues).toEqual(['Has 23 puzzles; needs exactly 24.'])
		expect(slots[2]).toMatchObject({
			state: 'live',
			issues: ['Awards no palette.'],
		})
	})

	it('treats a group whose puzzles have not loaded as a draft without a count issue', () => {
		const [basic] = slotReleases(progression, [], 'hexagon')
		expect(basic).toMatchObject({ state: 'draft', row: null, issues: [] })
	})
})

describe('countStates', () => {
	it('counts drafts, scheduled, and live rows', () => {
		expect(countStates([open, open, scheduled, live, live, live])).toEqual({
			draft: 2,
			scheduled: 1,
			live: 3,
		})
		expect(countStates([])).toEqual({ draft: 0, scheduled: 0, live: 0 })
	})
})

describe('palette groups', () => {
	it('sorts by purpose and then name', () => {
		const sorted = sortPaletteGroups([
			paletteGroup('u', 'undecided', 1, 'Zed'),
			paletteGroup('p', 'pack', 6, 'Alpha'),
			paletteGroup('r2', 'reward', 6, 'Beta'),
			paletteGroup('c', 'core', 6, 'Zen'),
			paletteGroup('r1', 'reward', 6, 'Alpha'),
		])
		expect(sorted.map(group => group.row.id)).toEqual([
			'c',
			'r1',
			'r2',
			'p',
			'u',
		])
	})

	it('describes what blocks a palette group', () => {
		expect(paletteGroupIssue(paletteGroup('a', 'undecided', 6))).toBe(
			'Choose a purpose.',
		)
		expect(paletteGroupIssue(paletteGroup('a', 'pack', 0))).toBe(
			'Has no palettes.',
		)
		expect(paletteGroupIssue(paletteGroup('a', 'reward', 5))).toBe(
			'Has 5 palettes; needs exactly 6.',
		)
		expect(paletteGroupIssue(paletteGroup('a', 'core', 7))).toBe(
			'Has 7 palettes; needs exactly 6.',
		)
		expect(paletteGroupIssue(paletteGroup('a', 'reward', 6))).toBe('')
		expect(paletteGroupIssue(paletteGroup('a', 'pack', 3))).toBe('')
	})
})

describe('otherPuzzleGroups', () => {
	it('lists groups outside every slot, by name', () => {
		const others = otherPuzzleGroups(progression, [
			puzzleGroup('basic', 24),
			puzzleGroup('z', 30, open, 'daily'),
			puzzleGroup('bonus', 24),
			puzzleGroup('a', 10, open, 'pack'),
		])
		expect(others.map(group => group.row.id)).toEqual(['a', 'z'])
	})
})

describe('packageRelease', () => {
	const slotsFor = (groups: PuzzleGroup[]) =>
		slotReleases(progression, groups, 'hexagon')

	it('reports a package with empty slots and its problems', () => {
		const pkg = packageRelease(
			slotsFor([puzzleGroup('basic', 23), puzzleGroup('bonus', 24)]),
		)
		expect(pkg.filled).toBe(2)
		expect(pkg.state).toBe('draft')
		expect(pkg.issues).toEqual([
			'Basic: Has 23 puzzles; needs exactly 24.',
			'Rotation: needs a puzzle group.',
			'Bonus Basic: Awards no palette.',
			'Bonus Rotation: needs a puzzle group.',
		])
	})

	it('takes its state from the groups when they agree', () => {
		expect(
			packageRelease(
				slotsFor([
					puzzleGroup('basic', 24, scheduled),
					puzzleGroup('bonus', 24, scheduled),
				]),
			),
		).toMatchObject({ state: 'scheduled' })
		expect(
			packageRelease(slotsFor([puzzleGroup('basic', 24, live)])),
		).toMatchObject({ state: 'live', filled: 2 })
	})

	it('is partial when groups disagree, standing for it with a prepared row', () => {
		const pkg = packageRelease(
			slotsFor([
				puzzleGroup('basic', 24),
				puzzleGroup('bonus', 24, scheduled),
			]),
		)
		expect(pkg.state).toBe('partial')
		expect(pkg.row?.id).toBe('bonus')
	})

	it('has no row when no group has loaded', () => {
		expect(packageRelease(slotsFor([]))).toMatchObject({
			row: null,
			state: 'draft',
		})
	})
})
