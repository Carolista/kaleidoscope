import { describe, expect, it } from 'vitest'
import { palettes, testContent } from '@/test/playerContent'
import { generatePuzzle } from '@/domain/puzzles'
import type { PlayerContent, PlayerPuzzleSet } from './playerContent'
import {
	availableContent,
	completesSet,
	accountShapeFor,
	newRewards,
	newShapes,
} from './rewards'

function set(
	id: string,
	kind: PlayerPuzzleSet['kind'],
	puzzleIds: readonly string[],
): PlayerPuzzleSet {
	return {
		id,
		name: id,
		shape: 'hexagon',
		track: 'basic',
		kind,
		puzzles: puzzleIds.map(puzzleId => ({
			id: puzzleId,
			name: puzzleId,
			difficulty: 'easy',
			palette: palettes[1],
			puzzle: generatePuzzle(puzzleId, palettes[1]),
		})),
	}
}

// The core set awards a palette that repeats a core one, a new palette, and the bonus set;
// the bonus set awards a palette and the deeper bonus set, which awards a palette too.
const core = set('core', 'core', ['c1', 'c2'])
const bonus = set('bonus', 'bonus', ['b1'])
const deeper = set('deeper', 'bonus', ['d1'])
const content: PlayerContent = {
	...testContent,
	palettes: palettes.slice(0, 2),
	puzzleSets: [core, bonus, deeper],
	rewards: [
		{
			setId: 'core',
			palettes: [palettes[1], palettes[2]],
			bonusSetIds: ['bonus'],
		},
		{ setId: 'bonus', palettes: [palettes[4]], bonusSetIds: ['deeper'] },
		{ setId: 'deeper', palettes: [palettes[3]], bonusSetIds: [] },
	],
}

const ids = (items: readonly { id: string }[]) => items.map(item => item.id)

describe('availableContent', () => {
	it('shows only core sets and core palettes before anything is earned', () => {
		const available = availableContent(content, new Set(['c1', 'b1']))
		expect(ids(available.puzzleSets)).toEqual(['core'])
		expect(ids(available.palettes)).toEqual(ids(palettes.slice(0, 2)))
	})

	it('earns nothing until every puzzle in a set is solved', () => {
		expect(
			ids(availableContent(content, new Set(['c1'])).puzzleSets),
		).toEqual(['core'])
	})

	it('adds the bonus set and the new palettes once a core set is complete', () => {
		const available = availableContent(content, new Set(['c1', 'c2']))
		expect(ids(available.puzzleSets)).toEqual(['core', 'bonus'])
		// The reward that repeats a core palette is not added twice.
		expect(ids(available.palettes)).toEqual([
			...ids(palettes.slice(0, 2)),
			palettes[2].id,
		])
	})

	it('chains rewards through bonus sets, in catalog order', () => {
		const available = availableContent(
			content,
			new Set(['c1', 'c2', 'b1', 'd1']),
		)
		expect(ids(available.puzzleSets)).toEqual(['core', 'bonus', 'deeper'])
		expect(ids(available.palettes)).toEqual([
			...ids(palettes.slice(0, 2)),
			palettes[2].id,
			palettes[4].id,
			palettes[3].id,
		])
	})

	it('ignores solved puzzles of a bonus set that is not open', () => {
		const available = availableContent(content, new Set(['b1', 'd1']))
		expect(ids(available.puzzleSets)).toEqual(['core'])
		expect(ids(available.palettes)).toEqual(ids(palettes.slice(0, 2)))
	})
})

describe('newRewards', () => {
	it('reports only what the latest solve earned', () => {
		expect(
			newRewards(content, new Set(['c1']), new Set(['c1', 'c2'])),
		).toEqual({
			palettes: [palettes[2]],
			bonusSets: [bonus],
			shapes: [],
			accountShape: null,
		})
		expect(
			newRewards(
				content,
				new Set(['c1', 'c2']),
				new Set(['c1', 'c2', 'b1']),
			),
		).toEqual({
			palettes: [palettes[4]],
			bonusSets: [deeper],
			shapes: [],
			accountShape: null,
		})
	})

	it('reports nothing when a solve completes no set', () => {
		expect(newRewards(content, new Set(), new Set(['c1']))).toEqual({
			palettes: [],
			bonusSets: [],
			shapes: [],
			accountShape: null,
		})
	})
})

describe('completesSet', () => {
	it('is true only when the puzzle finishes a set it belongs to', () => {
		expect(completesSet(content, 'c2', new Set(['c1', 'c2']))).toBe(true)
		expect(completesSet(content, 'c1', new Set(['c1']))).toBe(false)
		expect(completesSet(content, 'c1', new Set(['c1', 'b1']))).toBe(false)
		expect(completesSet(content, 'unknown', new Set(['c1', 'c2']))).toBe(
			false,
		)
	})
})

describe('newShapes', () => {
	it('lists each newly unlocked shape with its core sets only', () => {
		const triangleCore: PlayerPuzzleSet = {
			...set('tri', 'core', ['t1']),
			shape: 'triangle',
		}
		const triangleBonus: PlayerPuzzleSet = {
			...set('tri-bonus', 'bonus', ['t2']),
			shape: 'triangle',
		}
		const before: PlayerContent = {
			...content,
			unlockedShapes: ['hexagon'],
		}
		const after: PlayerContent = {
			...content,
			unlockedShapes: ['hexagon', 'triangle'],
			puzzleSets: [core, triangleCore, triangleBonus],
		}
		expect(newShapes(before, after)).toEqual([
			{ shape: 'triangle', sets: [triangleCore] },
		])
		expect(newShapes(after, after)).toEqual([])
	})
})

describe('accountShapeFor', () => {
	const locked: PlayerContent = { ...content, nextShape: 'triangle' }
	const everything = ['c1', 'c2', 'b1', 'd1']

	it('names the shape at the solve that finishes every open set', () => {
		expect(
			accountShapeFor(
				locked,
				new Set(everything.slice(0, 3)),
				new Set(everything),
			),
		).toBe('triangle')
	})

	it('waits while a set is unfinished, including bonus sets the core sets opened', () => {
		expect(
			accountShapeFor(locked, new Set(['c1']), new Set(['c1', 'c2'])),
		).toBeNull()
	})

	it('does not repeat once everything was already finished, or with no shape locked', () => {
		expect(
			accountShapeFor(locked, new Set(everything), new Set(everything)),
		).toBeNull()
		expect(
			accountShapeFor(
				content,
				new Set(everything.slice(0, 3)),
				new Set(everything),
			),
		).toBeNull()
	})
})
