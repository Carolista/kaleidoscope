import { describe, expect, it } from 'vitest'
import { checkRewardPattern, SLOT_ORDER, slotTitle } from './rewardPattern'
import type { GroupReward, ProgressionGroup } from './progression'
import { findUnavailablePalettes } from './paletteCoverage'

const names = {
	shape: (id: string) => id[0].toUpperCase() + id.slice(1),
	palette: (id: string) => `Palette ${id}`,
}
const group = (
	id: string,
	purpose: ProgressionGroup['purpose'],
	track: 'basic' | 'rotation',
	shapeId = 'hexagon',
): ProgressionGroup => ({
	id,
	name: id,
	purpose,
	shapeId,
	track,
	published: false,
})
const reward = (groupId: string, paletteIds: string[]): GroupReward => ({
	groupId,
	paletteIds,
	bonusGroupIds: [],
})

// A hexagon with all four slots filled, each awarding one palette.
const groups = [
	group('basic', 'core', 'basic'),
	group('rotation', 'core', 'rotation'),
	group('bonus-basic', 'reward', 'basic'),
	group('bonus-rotation', 'reward', 'rotation'),
]
const complete = [
	reward('basic', ['p1']),
	reward('rotation', ['p2']),
	reward('bonus-basic', ['p3']),
	reward('bonus-rotation', ['p4']),
]
const check = (
	g: ProgressionGroup[],
	r: GroupReward[],
	shapeIds = ['hexagon'],
) =>
	checkRewardPattern({ shapeIds, groups: g, rewards: r }, names).map(
		w => w.message,
	)

describe('slots', () => {
	it('lists the four slots in layout order with their titles', () => {
		expect(SLOT_ORDER.map(slot => slotTitle(slot))).toEqual([
			'Basic',
			'Rotation',
			'Bonus Basic',
			'Bonus Rotation',
		])
	})
})

describe('reward pattern checker', () => {
	it('accepts a shape with every slot filled and one palette each', () => {
		expect(check(groups, complete)).toEqual([])
	})

	it('reports every empty slot, by shape', () => {
		expect(check([], [], ['triangle'])).toEqual([
			'Triangle has no basic core group.',
			'Triangle has no rotation core group.',
			'Triangle has no basic bonus group.',
			'Triangle has no rotation bonus group.',
		])
	})

	it('reports filled slots that award nothing yet, with the group named', () => {
		expect(check(groups, [])).toEqual([
			'Basic core group "basic" awards nothing yet.',
			'Rotation core group "rotation" awards nothing yet.',
			'Basic bonus group "bonus-basic" awards nothing yet.',
			'Rotation bonus group "bonus-rotation" awards nothing yet.',
		])
	})

	it('wants exactly one palette per group', () => {
		expect(
			check(groups, [
				reward('basic', ['p1', 'p2']),
				reward('rotation', ['p3']),
				reward('bonus-basic', ['p4', 'p5', 'p6']),
				reward('bonus-rotation', ['p7']),
			]),
		).toEqual([
			'Basic core group "basic" should award exactly one palette (it awards 2).',
			'Basic bonus group "bonus-basic" should award exactly one palette (it awards 3).',
		])
	})

	it('ignores groups of other purposes and other shapes', () => {
		expect(
			check(
				[
					...groups,
					group('other', 'core', 'basic', 'triangle'),
					group('x', 'reward', 'basic', 'triangle'),
				],
				complete,
			),
		).toEqual([])
	})

	it('warns about a palette awarded by more than one group', () => {
		expect(
			check(groups, [
				reward('basic', ['p1']),
				reward('rotation', ['p2']),
				reward('bonus-basic', ['p3']),
				reward('bonus-rotation', ['p1']),
			]),
		).toEqual([
			'Palette "Palette p1" is awarded by more than one group: basic, bonus-rotation.',
		])
	})

	it('checks every shape in order and tags warnings with their shape and group', () => {
		const result = checkRewardPattern(
			{
				shapeIds: ['hexagon', 'triangle'],
				groups: [
					...groups,
					group('tri-basic', 'core', 'basic', 'triangle'),
				],
				rewards: complete,
			},
			names,
		)
		expect(result.map(w => [w.shapeId, w.groupId])).toEqual([
			['triangle', 'tri-basic'],
			['triangle', null],
			['triangle', null],
			['triangle', null],
		])
	})
})

describe('unavailable palettes', () => {
	const paletteGroups = [
		{ purpose: 'core' as const, members: [{ id: 'free' }] },
		{ purpose: 'reward' as const, members: [{ id: 'earned' }] },
		{ purpose: 'pack' as const, members: [{ id: 'sold' }] },
		{ purpose: 'undecided' as const, members: [{ id: 'maybe' }] },
	]
	const puzzle = (
		name: string,
		paletteId: string,
		groupName: string | null,
	) => ({
		name,
		paletteId,
		groupName,
	})
	const paletteName = (id: string) => id.toUpperCase()

	it('lists puzzles whose palette no player can get, grouped by palette', () => {
		expect(
			findUnavailablePalettes({
				puzzles: [
					puzzle('A', 'free', 'Core'),
					puzzle('B', 'earned', 'Core'),
					puzzle('C', 'sold', 'Pack'),
					puzzle('Z', 'maybe', 'Pack'),
					puzzle('Y', 'orphan', 'Pack'),
					puzzle('X', 'orphan', 'Core'),
					puzzle('W', 'zzz', 'Core'),
				],
				paletteGroups,
				paletteName,
			}),
		).toEqual([
			{ paletteId: 'maybe', paletteName: 'MAYBE', puzzles: ['Z'] },
			{ paletteId: 'orphan', paletteName: 'ORPHAN', puzzles: ['X', 'Y'] },
			{ paletteId: 'zzz', paletteName: 'ZZZ', puzzles: ['W'] },
		])
	})

	it('ignores puzzles that are not in a group yet', () => {
		expect(
			findUnavailablePalettes({
				puzzles: [puzzle('A', 'orphan', null)],
				paletteGroups,
				paletteName,
			}),
		).toEqual([])
	})
})
