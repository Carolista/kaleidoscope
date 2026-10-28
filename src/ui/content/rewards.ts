import type { PlayerPalette } from '@/domain/palettes'
import { supportedGridShapes, type GridShapeId } from '@/domain/shapes'
import type {
	Locked,
	PlayerContent,
	PlayerPuzzleSet,
	PlayerReward,
} from './playerContent'

interface Earned {
	// Bonus sets the player may play, plus every core set of a shape they have.
	readonly openSetIds: ReadonlySet<string>
	readonly palettes: readonly PlayerPalette[]
	readonly shapes: readonly GridShapeId[]
	readonly lockedPalettes: readonly Locked<PlayerPalette>[]
	readonly lockedSets: readonly Locked<PlayerPuzzleSet>[]
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

// The shapes open to the player. For an account that is what the server last said plus
// whatever the player's own solves have opened since, so finishing a set offline still opens
// the next shape (the same rule as the database: a finished core set of one shape opens
// the next). A guest never opens a shape.
function openShapes(
	content: PlayerContent,
	solved: ReadonlySet<string>,
	account: boolean,
): readonly GridShapeId[] {
	const order = content.shapeOrder
	if (!account || !order.length) return content.unlockedShapes
	const open = new Set(content.unlockedShapes)
	let changed = true
	while (changed) {
		changed = false
		order.forEach((shape, index) => {
			const previous = order[index - 1]
			if (
				index === 0 ||
				open.has(shape) ||
				!open.has(previous) ||
				!content.puzzleSets.some(
					set =>
						set.kind === 'core' &&
						set.shape === previous &&
						isComplete(set, solved),
				)
			)
				return
			open.add(shape)
			changed = true
		})
	}
	return order.filter(shape => open.has(shape))
}

// The prize for finishing every free set: all shapes open and every set solved, with the
// four sets per shape the database also requires.
function finishedEverything(
	content: PlayerContent,
	solved: ReadonlySet<string>,
	shapes: readonly GridShapeId[],
): boolean {
	return (
		content.shapeOrder.length > 0 &&
		content.shapeOrder.every(
			shape =>
				shapes.includes(shape) &&
				content.puzzleSets.filter(set => set.shape === shape).length >=
					4,
		) &&
		content.puzzleSets.every(set => isComplete(set, solved))
	)
}

const shapeLabel = (shape: GridShapeId) =>
	supportedGridShapes.find(item => item.id === shape)?.label ?? shape

// In the order the sets are listed everywhere else: by shape, then core before bonus, then basic before rotation.
function sortLocked(
	locked: readonly Locked<PlayerPuzzleSet>[],
	order: readonly GridShapeId[],
): Locked<PlayerPuzzleSet>[] {
	const rank = (shape: GridShapeId) => {
		const index = order.indexOf(shape)
		return index === -1 ? order.length : index
	}
	return [...locked].sort(
		(a, b) =>
			rank(a.item.shape) - rank(b.item.shape) ||
			(a.item.kind === b.item.kind
				? 0
				: a.item.kind === 'core'
					? -1
					: 1) ||
			(a.item.track === b.item.track
				? 0
				: a.item.track === 'basic'
					? -1
					: 1) ||
			a.item.name.localeCompare(b.item.name),
	)
}

// A reward counts once its set is complete and the set itself is open, so a
// bonus set can award more bonus sets. Repeating until nothing changes handles that chain.
function earnedRewards(
	content: PlayerContent,
	solved: ReadonlySet<string>,
	account: boolean,
): Earned {
	const shapes = openShapes(content, solved, account)
	const order = content.shapeOrder
	const sets = new Map(content.puzzleSets.map(set => [set.id, set]))
	const open = new Set(
		content.puzzleSets
			.filter(set => set.kind === 'core' && shapes.includes(set.shape))
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
	// Sets the player cannot read yet are known too, though only to name what unlocks what.
	const known = new Map(
		[...content.puzzleSets, ...content.previewSets].map(set => [
			set.id,
			set,
		]),
	)
	const setName = (id: string) => known.get(id)?.name ?? ''
	const lockedPalettes = content.rewards
		.filter(reward => !awarded.has(reward))
		.flatMap(reward =>
			reward.palettes.map(item => ({
				item,
				unlockedBy: setName(reward.setId),
			})),
		)
		.filter(({ item }) => {
			if (seen.has(item.id)) return false
			seen.add(item.id)
			return true
		})
	const lockedSets = sortLocked(
		[...known.values()].flatMap(item => {
			if (open.has(item.id)) return []
			const source = content.rewards.find(reward =>
				reward.bonusSetIds.includes(item.id),
			)
			if (source) return [{ item, unlockedBy: setName(source.setId) }]
			const previous = order[order.indexOf(item.shape) - 1]
			return item.kind === 'core' && previous
				? [{ item, unlockedBy: `a ${shapeLabel(previous)} set` }]
				: []
		}),
		order,
	)
	return { openSetIds: open, palettes, shapes, lockedPalettes, lockedSets }
}

// The content this player may use: core sets and palettes, plus the bonus sets
// and reward palettes earned by completing sets. What is still to be earned is listed
// apart, as locked. For an account the
// shapes (and the randomizer) include what its own solves have opened, which the server
// confirms when they are recorded, so progress made offline is usable at once.
export function availableContent(
	content: PlayerContent,
	solved: ReadonlySet<string>,
	account = false,
): PlayerContent {
	const { openSetIds, palettes, shapes, lockedPalettes, lockedSets } =
		earnedRewards(content, solved, account)
	return {
		...content,
		unlockedShapes: shapes,
		nextShape: account
			? (content.shapeOrder.find(shape => !shapes.includes(shape)) ??
				null)
			: content.nextShape,
		randomizerUnlocked:
			content.randomizerUnlocked ||
			(account && finishedEverything(content, solved, shapes)),
		palettes: [...content.palettes, ...palettes],
		lockedPalettes,
		lockedPuzzleSets: lockedSets,
		puzzleSets: content.puzzleSets.filter(set => openSetIds.has(set.id)),
	}
}

// What solving one more puzzle gives the player for the first time.
export function newRewards(
	content: PlayerContent,
	before: ReadonlySet<string>,
	after: ReadonlySet<string>,
	account = false,
): NewRewards {
	const previous = earnedRewards(content, before, account)
	const current = earnedRewards(content, after, account)
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
