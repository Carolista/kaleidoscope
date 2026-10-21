import { describe, expect, it } from 'vitest'
import { checkRewardPattern } from './rewardPattern'
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
const reward = (
	groupId: string,
	paletteIds: string[],
	bonusGroupIds: string[] = [],
): GroupReward => ({ groupId, paletteIds, bonusGroupIds })

// A hexagon that follows the pattern exactly.
const groups = [
	group('basic', 'core', 'basic'),
	group('rotation', 'core', 'rotation'),
	group('bonus-basic', 'reward', 'basic'),
	group('bonus-rotation', 'reward', 'rotation'),
]
const complete = [
	reward('basic', ['p1']),
	reward('rotation', ['p2'], ['bonus-basic', 'bonus-rotation']),
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

describe('reward pattern checker', () => {
	it('accepts a shape that follows the pattern', () => {
		expect(check(groups, complete)).toEqual([])
	})

	it('reports missing core groups and unrewarded groups', () => {
		expect(check([], [], ['triangle'])).toEqual([
			'Triangle has no basic core group.',
			'Triangle has no rotation core group.',
		])
		expect(check(groups, [])).toEqual([
			'Basic core group "basic" awards nothing yet.',
			'Rotation core group "rotation" awards nothing yet.',
			'Rotation core group "rotation" should award two bonus groups, one basic and one rotation (it awards 0).',
			'Reward group "bonus-basic" is not awarded by the Hexagon rotation core group.',
			'Reward group "bonus-rotation" is not awarded by the Hexagon rotation core group.',
		])
	})

	it('wants exactly one palette per core and bonus group', () => {
		const messages = check(groups, [
			reward('basic', ['p1', 'p2']),
			reward('rotation', ['p3', 'p4'], ['bonus-basic', 'bonus-rotation']),
			reward('bonus-basic', ['p5', 'p6']),
			reward('bonus-rotation', ['p7']),
		])
		expect(messages).toContain(
			'Basic core group "basic" should award exactly one palette (it awards 2).',
		)
		expect(messages).toContain(
			'Rotation core group "rotation" should award exactly one palette (it awards 2).',
		)
		expect(messages).toContain(
			'Bonus group "bonus-basic" should award exactly one palette (it awards 2).',
		)
		expect(messages).not.toContainEqual(
			expect.stringContaining('bonus-rotation" should'),
		)
	})

	it('keeps bonus groups off the basic core group and off bonus groups', () => {
		const messages = check(groups, [
			reward('basic', ['p1'], ['bonus-basic']),
			reward('rotation', ['p2'], ['bonus-basic', 'bonus-rotation']),
			reward('bonus-basic', ['p3'], ['bonus-rotation']),
			reward('bonus-rotation', ['p4']),
		])
		expect(messages).toEqual([
			'Basic core group "basic" should not award bonus groups.',
			'Bonus group "bonus-basic" should not award bonus groups.',
		])
	})

	it('wants one basic and one rotation bonus group of the same shape', () => {
		const twoBasic = [...groups, group('bonus-basic-2', 'reward', 'basic')]
		expect(
			check(twoBasic, [
				...complete.slice(0, 1),
				reward('rotation', ['p2'], ['bonus-basic', 'bonus-basic-2']),
				reward('bonus-basic', ['p3']),
				reward('bonus-basic-2', ['p5']),
			]),
		).toContain(
			'The bonus groups of "rotation" should be one basic and one rotation.',
		)
		expect(
			check(
				[
					...groups,
					group('other-rotation', 'reward', 'rotation', 'triangle'),
				],
				[
					...complete.slice(0, 1),
					reward(
						'rotation',
						['p2'],
						['bonus-basic', 'other-rotation'],
					),
					reward('bonus-basic', ['p3']),
					reward('other-rotation', ['p5']),
				],
			),
		).toContain(
			'Bonus group "other-rotation" belongs to a different shape than "rotation".',
		)
		expect(
			check(groups, [
				...complete.slice(0, 1),
				reward('rotation', ['p2'], ['bonus-basic']),
				reward('bonus-basic', ['p3']),
			]),
		).toContain(
			'Rotation core group "rotation" should award two bonus groups, one basic and one rotation (it awards 1).',
		)
	})

	it('warns about a palette awarded by more than one group', () => {
		const messages = check(groups, [
			...complete.slice(0, 3),
			reward('bonus-rotation', ['p1']),
		])
		expect(messages).toEqual([
			'Palette "Palette p1" is awarded by more than one group: basic, bonus-rotation.',
		])
	})

	it('checks every shape, in order, and tags warnings with their shape and group', () => {
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
			['triangle', null],
			['triangle', 'tri-basic'],
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
