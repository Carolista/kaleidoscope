import { describe, expect, it } from 'vitest'
import { palettes, testContent } from '@/test/playerContent'
import { generatePuzzle } from '@/domain/puzzles'
import type { PlayerContent, PlayerPuzzleSet } from './playerContent'
import { availableContent, newRewards } from './rewards'

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
		).toEqual({ palettes: [palettes[2]], bonusSets: [bonus] })
		expect(
			newRewards(
				content,
				new Set(['c1', 'c2']),
				new Set(['c1', 'c2', 'b1']),
			),
		).toEqual({ palettes: [palettes[4]], bonusSets: [deeper] })
	})

	it('reports nothing when a solve completes no set', () => {
		expect(newRewards(content, new Set(), new Set(['c1']))).toEqual({
			palettes: [],
			bonusSets: [],
		})
	})
})
