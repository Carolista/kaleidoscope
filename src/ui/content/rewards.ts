import type { PlayerPalette } from '@/domain/palettes'
import type {
	PlayerContent,
	PlayerPuzzleSet,
	PlayerReward,
} from './playerContent'

interface Earned {
	// Bonus sets the player may play, plus every core set.
	readonly openSetIds: ReadonlySet<string>
	readonly palettes: readonly PlayerPalette[]
}

export interface NewRewards {
	readonly palettes: readonly PlayerPalette[]
	readonly bonusSets: readonly PlayerPuzzleSet[]
}

function isComplete(set: PlayerPuzzleSet, solved: ReadonlySet<string>) {
	return set.puzzles.every(puzzle => solved.has(puzzle.id))
}

// A reward counts once its set is complete and the set itself is open, so a
// bonus set can award more bonus sets. Repeating until nothing changes handles that chain.
function earnedRewards(
	content: PlayerContent,
	solved: ReadonlySet<string>,
): Earned {
	const sets = new Map(content.puzzleSets.map(set => [set.id, set]))
	const open = new Set(
		content.puzzleSets
			.filter(set => set.kind === 'core')
			.map(set => set.id),
	)
	const awarded = new Set<PlayerReward>()
	let changed = true
	while (changed) {
		changed = false
		for (const reward of content.rewards) {
			const set = sets.get(reward.setId)
			if (
				awarded.has(reward) ||
				!set ||
				!open.has(set.id) ||
				!isComplete(set, solved)
			)
				continue
			awarded.add(reward)
			changed = true
			for (const id of reward.bonusSetIds) if (sets.has(id)) open.add(id)
		}
	}
	const seen = new Set(content.palettes.map(palette => palette.id))
	// Catalog order, not the order of discovery, keeps Zen's palette list steady.
	const palettes = content.rewards
		.filter(reward => awarded.has(reward))
		.flatMap(reward => reward.palettes)
		.filter(palette => {
			if (seen.has(palette.id)) return false
			seen.add(palette.id)
			return true
		})
	return { openSetIds: open, palettes }
}

// The content this player may use: core sets and palettes, plus the bonus sets
// and reward palettes earned by completing sets. Nothing else is shown.
export function availableContent(
	content: PlayerContent,
	solved: ReadonlySet<string>,
): PlayerContent {
	const { openSetIds, palettes } = earnedRewards(content, solved)
	return {
		...content,
		palettes: [...content.palettes, ...palettes],
		puzzleSets: content.puzzleSets.filter(set => openSetIds.has(set.id)),
	}
}

// What solving one more puzzle gives the player for the first time.
export function newRewards(
	content: PlayerContent,
	before: ReadonlySet<string>,
	after: ReadonlySet<string>,
): NewRewards {
	const previous = earnedRewards(content, before)
	const current = earnedRewards(content, after)
	const known = new Set(previous.palettes.map(palette => palette.id))
	return {
		palettes: current.palettes.filter(palette => !known.has(palette.id)),
		bonusSets: content.puzzleSets.filter(
			set =>
				set.kind === 'bonus' &&
				current.openSetIds.has(set.id) &&
				!previous.openSetIds.has(set.id),
		),
	}
}
