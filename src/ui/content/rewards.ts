import type { PlayerPalette } from '@/domain/palettes'
import type { GridShapeId } from '@/domain/shapes'
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

// A shape the player can now use in Zen, with the core sets that came with it.
export interface UnlockedShape {
	readonly shape: GridShapeId
	readonly sets: readonly PlayerPuzzleSet[]
}

export interface NewRewards {
	readonly palettes: readonly PlayerPalette[]
	readonly bonusSets: readonly PlayerPuzzleSet[]
	// Only an account can unlock shapes, and only once the server has confirmed it.
	readonly shapes: readonly UnlockedShape[]
	// Set when a guest has just finished every set open to them and the next shape
	// needs an account.
	readonly accountShape: GridShapeId | null
	// Set when this solve earned Zen's randomizer, by finishing every core and bonus set.
	readonly randomizer: boolean
}

function isComplete(set: PlayerPuzzleSet, solved: ReadonlySet<string>) {
	return set.puzzles.every(puzzle => solved.has(puzzle.id))
}

// Whether solving this puzzle just finished a set it belongs to.
export function completesSet(
	content: PlayerContent,
	puzzleId: string,
	solved: ReadonlySet<string>,
): boolean {
	return content.puzzleSets.some(
		set =>
			set.puzzles.some(puzzle => puzzle.id === puzzleId) &&
			isComplete(set, solved),
	)
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
		shapes: [],
		accountShape: null,
		randomizer: false,
	}
}

function allComplete(content: PlayerContent, solved: ReadonlySet<string>) {
	const { puzzleSets } = availableContent(content, solved)
	return (
		puzzleSets.length > 0 &&
		puzzleSets.every(set => isComplete(set, solved))
	)
}

// The shape a guest must create an account for, at the solve that finishes everything
// they can play. Finishing means every open set, bonus sets included, so it cannot
// happen before the core sets have opened their bonus sets.
export function accountShapeFor(
	content: PlayerContent,
	before: ReadonlySet<string>,
	after: ReadonlySet<string>,
): GridShapeId | null {
	return content.nextShape &&
		allComplete(content, after) &&
		!allComplete(content, before)
		? content.nextShape
		: null
}

// The shapes that opened between two loads of the same player's content.
export function newShapes(
	before: PlayerContent,
	after: PlayerContent,
): UnlockedShape[] {
	return after.unlockedShapes
		.filter(shape => !before.unlockedShapes.includes(shape))
		.map(shape => ({
			shape,
			sets: after.puzzleSets.filter(
				set => set.kind === 'core' && set.shape === shape,
			),
		}))
}
