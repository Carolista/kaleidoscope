import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/lib/supabase'
import type { PlayerPalette } from '@/domain/palettes'
import { PUZZLE_RECIPES, readPlayablePuzzle } from '@/domain/puzzles'
import {
	isGridShapeId,
	supportedGridShapes,
	type GridShapeId,
} from '@/domain/shapes'
import type {
	PlayerContent,
	PlayerPuzzle,
	PlayerPuzzleSet,
	PlayerReward,
} from './playerContent'
import { toTitleCase } from '@/ui/text'

interface Released {
	readonly published_at: string | null
	readonly release_at: string | null
}

// Row security already hides unreleased content from guests. Checking again keeps
// drafts out even if the request ever runs with elevated access.
function isLive(row: Released): boolean {
	return (
		!!row.published_at &&
		!!row.release_at &&
		Date.parse(row.release_at) <= Date.now()
	)
}

// Palettes, puzzles, and sets are named in the admin portal; players see them in title case.
const displayName = (name: string) => toTitleCase(name.trim())

function toPalette(
	row: (Released & { id: string; name: string; colors: string[] }) | null,
): PlayerPalette | null {
	if (
		!row ||
		!isLive(row) ||
		row.colors.length !== 5 ||
		row.colors.some(color => !/^#[0-9a-f]{6}$/i.test(color))
	)
		return null
	const [a, b, c, d, e] = row.colors
	return { id: row.id, name: displayName(row.name), colors: [a, b, c, d, e] }
}

const byPosition = (a: { position: number }, b: { position: number }) =>
	a.position - b.position

async function loadPalettes(
	client: SupabaseClient<Database>,
): Promise<PlayerPalette[]> {
	const { data, error } = await client
		.from('palette_groups')
		.select(
			'id, name, published_at, release_at, palette_group_members(position, palettes(id, name, colors, published_at, release_at))',
		)
		.eq('purpose', 'core')
	if (error) throw new Error(error.message)
	const seen = new Set<string>()
	return data
		.filter(isLive)
		.sort((a, b) => a.name.localeCompare(b.name))
		.flatMap(group =>
			[...group.palette_group_members]
				.sort(byPosition)
				.map(member => toPalette(member.palettes)),
		)
		.filter((palette): palette is PlayerPalette => {
			if (!palette || seen.has(palette.id)) return false
			seen.add(palette.id)
			return true
		})
}

async function loadShapeOrder(client: SupabaseClient<Database>) {
	const { data, error } = await client
		.from('shape_progression')
		.select('shape_id, position')
		.order('position')
	if (error) throw new Error(error.message)
	return data.map(row => row.shape_id).filter(isGridShapeId)
}

type PaletteRow = Released & { id: string; name: string; colors: string[] }
type PuzzleRow = Tables<'puzzles'> & { palettes: PaletteRow | null }

// Free puzzles this account has not earned yet but needs on hand, so that a set finished
// offline can open what it earns. The database returns only the next tier (see
// `preview_puzzles`). They earn nothing by being loaded. A failure is not fatal: the player
// just waits for a connection to open what they earn.
async function loadPreviewPuzzles(
	client: SupabaseClient<Database>,
): Promise<Map<string, PuzzleRow>> {
	try {
		const { data, error } = await client.rpc('preview_puzzles')
		if (error) throw new Error(error.message)
		if (!data.length) return new Map()
		const paletteIds = [...new Set(data.map(row => row.palette_id))]
		const palettes = await client
			.from('palettes')
			.select('id, name, colors, published_at, release_at')
			.in('id', paletteIds)
		if (palettes.error) throw new Error(palettes.error.message)
		const byId = new Map(palettes.data.map(row => [row.id, row]))
		return new Map(
			data.map(row => [
				row.id,
				{ ...row, palettes: byId.get(row.palette_id) ?? null },
			]),
		)
	} catch (cause) {
		console.warn('Could not load upcoming puzzles.', cause)
		return new Map()
	}
}

async function loadPuzzleSets(
	client: SupabaseClient<Database>,
	account: boolean,
): Promise<PlayerPuzzleSet[]> {
	const [{ data, error }, previews] = await Promise.all([
		client
			.from('puzzle_groups')
			.select(
				'id, name, purpose, shape_id, track, published_at, release_at, puzzle_group_members(position, puzzle_id, puzzles(*, palettes(id, name, colors, published_at, release_at)))',
			)
			.in('purpose', ['core', 'reward']),
		account
			? loadPreviewPuzzles(client)
			: Promise.resolve(new Map<string, PuzzleRow>()),
	])
	if (error) throw new Error(error.message)
	return data.flatMap(group => {
		const { shape_id: shape, track } = group
		if (
			!isLive(group) ||
			!isGridShapeId(shape) ||
			(track !== 'basic' && track !== 'rotation')
		)
			return []
		const puzzles = [...group.puzzle_group_members]
			.sort(byPosition)
			.flatMap((member): PlayerPuzzle[] => {
				const row = member.puzzles ?? previews.get(member.puzzle_id)
				if (!row || !isLive(row)) return []
				const palette = toPalette(row.palettes)
				const difficulty = PUZZLE_RECIPES.find(
					value => value.difficulty === row.difficulty,
				)?.difficulty
				if (!palette || !difficulty) return []
				try {
					return [
						{
							id: row.id,
							name: displayName(row.name),
							difficulty,
							palette,
							puzzle: readPlayablePuzzle(row, palette),
						},
					]
				} catch (cause) {
					console.error(cause)
					return []
				}
			})
		return puzzles.length
			? [
					{
						id: group.id,
						name: displayName(group.name),
						shape,
						track,
						kind: group.purpose === 'reward' ? 'bonus' : 'core',
						puzzles,
					},
				]
			: []
	})
}

// What completing a set gives: reward palettes and bonus sets, as the database links them.
async function loadRewards(
	client: SupabaseClient<Database>,
): Promise<PlayerReward[]> {
	const { data, error } = await client
		.from('reward_rules')
		.select(
			'group_id, reward_palettes(palettes(id, name, colors, published_at, release_at)), reward_puzzle_groups(group_id)',
		)
	if (error) throw new Error(error.message)
	return data.map(rule => ({
		setId: rule.group_id,
		palettes: rule.reward_palettes
			.map(row => toPalette(row.palettes))
			.filter((palette): palette is PlayerPalette => !!palette),
		bonusSetIds: rule.reward_puzzle_groups.map(row => row.group_id),
	}))
}

// Only rewards of sets that loaded count, and a bonus set that did not load is left out.
// They follow the order of the sets, which is the order reward palettes reach Zen.
function usableRewards(
	rewards: readonly PlayerReward[],
	sets: readonly PlayerPuzzleSet[],
): PlayerReward[] {
	const loaded = new Set(sets.map(set => set.id))
	const position = (reward: PlayerReward) =>
		sets.findIndex(set => set.id === reward.setId)
	return rewards
		.flatMap(reward => {
			const bonusSetIds = reward.bonusSetIds.filter(id => loaded.has(id))
			return loaded.has(reward.setId) &&
				(reward.palettes.length || bonusSetIds.length)
				? [{ ...reward, bonusSetIds }]
				: []
		})
		.sort((a, b) => position(a) - position(b))
}

function sortSets(
	sets: readonly PlayerPuzzleSet[],
	shapeOrder: readonly string[],
) {
	const rank = (shape: string) => {
		const index = shapeOrder.indexOf(shape)
		return index === -1 ? shapeOrder.length : index
	}
	return [...sets].sort(
		(a, b) =>
			rank(a.shape) - rank(b.shape) ||
			(a.kind === b.kind ? 0 : a.kind === 'core' ? -1 : 1) ||
			(a.track === b.track ? 0 : a.track === 'basic' ? -1 : 1) ||
			a.name.localeCompare(b.name),
	)
}

// Mirrors the database's `has_shape`: the first shape, a granted shape, or the shape after
// one whose core group the account has completed. Rows are asked for by player, since an
// admin's session can read every account's.
async function loadAccountShapes(
	client: SupabaseClient<Database>,
	userId: string,
	order: readonly GridShapeId[],
): Promise<GridShapeId[]> {
	const [completions, grants] = await Promise.all([
		client
			.from('group_completions')
			.select('puzzle_groups(shape_id, purpose)')
			.eq('user_id', userId),
		client.from('shape_grants').select('shape_id').eq('user_id', userId),
	])
	if (completions.error) throw new Error(completions.error.message)
	if (grants.error) throw new Error(grants.error.message)
	const finishedCore = new Set(
		completions.data.flatMap(row =>
			row.puzzle_groups?.purpose === 'core' && row.puzzle_groups.shape_id
				? [row.puzzle_groups.shape_id]
				: [],
		),
	)
	const granted = new Set(grants.data.map(row => row.shape_id))
	return order.filter(
		(shape, index) =>
			index === 0 ||
			granted.has(shape) ||
			finishedCore.has(order[index - 1]),
	)
}

// The server grants the randomizer once, permanently, when every free set is complete.
async function loadRandomizerGrant(
	client: SupabaseClient<Database>,
	userId: string,
): Promise<boolean> {
	const { data, error } = await client
		.from('feature_grants')
		.select('feature')
		.eq('user_id', userId)
		.eq('feature', 'zen_randomizer')
	if (error) throw new Error(error.message)
	return data.length > 0
}

// A guest starts with the first shape and reads exactly that; an account is allowed on
// further shapes as it finishes core sets, which the database enforces as it answers.
export async function loadPlayerContent(
	client: SupabaseClient<Database>,
	{ account }: { readonly account?: { readonly userId: string } } = {},
): Promise<PlayerContent> {
	const [palettes, shapeOrder, puzzleSets, rewards] = await Promise.all([
		loadPalettes(client),
		loadShapeOrder(client),
		loadPuzzleSets(client, !!account),
		loadRewards(client),
	])
	const order = shapeOrder.length ? shapeOrder : [supportedGridShapes[0].id]
	const sets = sortSets(puzzleSets, order)
	const [unlockedShapes, randomizerUnlocked] = account
		? await Promise.all([
				loadAccountShapes(client, account.userId, order),
				loadRandomizerGrant(client, account.userId),
			])
		: [[order[0]], false]
	return {
		palettes,
		lockedPalettes: [],
		lockedPuzzleSets: [],
		unlockedShapes,
		shapeOrder: order,
		randomizerUnlocked,
		nextShape: order.find(shape => !unlockedShapes.includes(shape)) ?? null,
		puzzleSets: sets,
		rewards: usableRewards(rewards, sets),
	}
}
