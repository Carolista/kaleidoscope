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
			randomizer: false,
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
			randomizer: false,
		})
	})

	it('reports nothing when a solve completes no set', () => {
		expect(newRewards(content, new Set(), new Set(['c1']))).toEqual({
			palettes: [],
			bonusSets: [],
			shapes: [],
			accountShape: null,
			randomizer: false,
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

describe('an account’s own solves open shapes before the server confirms them', () => {
	const inShape = (
		item: PlayerPuzzleSet,
		shape: PlayerPuzzleSet['shape'],
	): PlayerPuzzleSet => ({ ...item, shape })
	const hexCore = set('hex-core', 'core', ['h1'])
	const triangleCore = inShape(set('tri-core', 'core', ['t1']), 'triangle')
	const diamondCore = inShape(set('dia-core', 'core', ['d1']), 'diamondStar')
	const ahead: PlayerContent = {
		...testContent,
		palettes: palettes.slice(0, 2),
		unlockedShapes: ['hexagon'],
		shapeOrder: ['hexagon', 'triangle', 'diamondStar'],
		nextShape: 'triangle',
		randomizerUnlocked: false,
		puzzleSets: [hexCore, triangleCore, diamondCore],
		rewards: [],
	}

	it('hides the sets of a shape that is still locked, however they were loaded', () => {
		const available = availableContent(ahead, new Set(), true)
		expect(ids(available.puzzleSets)).toEqual(['hex-core'])
		expect(available.unlockedShapes).toEqual(['hexagon'])
		expect(available.nextShape).toBe('triangle')
	})

	it('opens the next shape and its core sets when a core set is finished, and chains from there', () => {
		const opened = availableContent(ahead, new Set(['h1']), true)
		expect(opened.unlockedShapes).toEqual(['hexagon', 'triangle'])
		expect(opened.nextShape).toBe('diamondStar')
		expect(ids(opened.puzzleSets)).toEqual(['hex-core', 'tri-core'])
		const chained = availableContent(ahead, new Set(['h1', 't1']), true)
		expect(chained.unlockedShapes).toEqual([
			'hexagon',
			'triangle',
			'diamondStar',
		])
		expect(chained.nextShape).toBeNull()
	})

	it('keeps a shape the server already opened, such as a granted one', () => {
		const granted = availableContent(
			{ ...ahead, unlockedShapes: ['hexagon', 'diamondStar'] },
			new Set(),
			true,
		)
		expect(granted.unlockedShapes).toEqual(['hexagon', 'diamondStar'])
		expect(granted.nextShape).toBe('triangle')
	})

	it('never opens a shape for a guest', () => {
		const guest = availableContent(ahead, new Set(['h1']))
		expect(guest.unlockedShapes).toEqual(['hexagon'])
		expect(ids(guest.puzzleSets)).toEqual(['hex-core'])
		expect(guest.nextShape).toBe('triangle')
	})

	it('reports the shape a solve opened, with its core sets', () => {
		const before = availableContent(ahead, new Set(), true)
		const after = availableContent(ahead, new Set(['h1']), true)
		expect(
			newShapes(before, after).map(item => [item.shape, ids(item.sets)]),
		).toEqual([['triangle', ['tri-core']]])
	})

	it('awards the bonus set and palette of a set finished in a shape that was opened offline', () => {
		const withRewards: PlayerContent = {
			...ahead,
			puzzleSets: [
				...ahead.puzzleSets,
				set('tri-bonus', 'bonus', ['tb1']),
			].map(item =>
				item.id === 'tri-bonus' ? inShape(item, 'triangle') : item,
			),
			rewards: [
				{
					setId: 'tri-core',
					palettes: [palettes[5]],
					bonusSetIds: ['tri-bonus'],
				},
			],
		}
		const earned = newRewards(
			withRewards,
			new Set(['h1']),
			new Set(['h1', 't1']),
			true,
		)
		expect(ids(earned.bonusSets)).toEqual(['tri-bonus'])
		expect(ids(earned.palettes)).toEqual([palettes[5].id])
	})

	describe('the randomizer', () => {
		const sets = [
			set('core-basic', 'core', ['a']),
			set('core-rotation', 'core', ['b']),
			set('bonus-basic', 'bonus', ['c']),
			set('bonus-rotation', 'bonus', ['d']),
		]
		const finished: PlayerContent = {
			...testContent,
			unlockedShapes: ['hexagon'],
			shapeOrder: ['hexagon'],
			randomizerUnlocked: false,
			puzzleSets: sets,
			rewards: [],
		}

		it('is earned once every set of every shape is solved', () => {
			const all = new Set(['a', 'b', 'c', 'd'])
			expect(
				availableContent(finished, all, true).randomizerUnlocked,
			).toBe(true)
			expect(availableContent(finished, all).randomizerUnlocked).toBe(
				false,
			)
		})

		it('waits for an unsolved set, a locked shape, or fewer than four sets a shape', () => {
			expect(
				availableContent(finished, new Set(['a', 'b', 'c']), true)
					.randomizerUnlocked,
			).toBe(false)
			expect(
				availableContent(
					{ ...finished, shapeOrder: ['hexagon', 'triangle'] },
					new Set(['a', 'b', 'c', 'd']),
					true,
				).randomizerUnlocked,
			).toBe(false)
			expect(
				availableContent(
					{ ...finished, puzzleSets: sets.slice(0, 3) },
					new Set(['a', 'b', 'c']),
					true,
				).randomizerUnlocked,
			).toBe(false)
		})

		it('stays earned when the server already granted it', () => {
			expect(
				availableContent(
					{ ...finished, randomizerUnlocked: true },
					new Set(),
					true,
				).randomizerUnlocked,
			).toBe(true)
		})
	})
})
