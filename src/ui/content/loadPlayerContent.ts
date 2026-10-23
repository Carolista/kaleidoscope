import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import type { PlayerPalette } from '@/domain/palettes'
import { PUZZLE_RECIPES, readPlayablePuzzle } from '@/domain/puzzles'
import { isGridShapeId, supportedGridShapes } from '@/domain/shapes'
import type {
	PlayerContent,
	PlayerPuzzle,
	PlayerPuzzleSet,
} from './playerContent'

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
	return { id: row.id, name: row.name, colors: [a, b, c, d, e] }
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

async function loadPuzzleSets(
	client: SupabaseClient<Database>,
): Promise<PlayerPuzzleSet[]> {
	const { data, error } = await client
		.from('puzzle_groups')
		.select(
			'id, name, shape_id, track, published_at, release_at, puzzle_group_members(position, puzzles(*, palettes(id, name, colors, published_at, release_at)))',
		)
		.eq('purpose', 'core')
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
				const row = member.puzzles
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
							name: row.name,
							difficulty,
							puzzle: readPlayablePuzzle(row, palette),
						},
					]
				} catch (cause) {
					console.error(cause)
					return []
				}
			})
		return puzzles.length
			? [{ id: group.id, name: group.name, shape, track, puzzles }]
			: []
	})
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
			(a.track === b.track ? 0 : a.track === 'basic' ? -1 : 1) ||
			a.name.localeCompare(b.name),
	)
}

export async function loadPlayerContent(
	client: SupabaseClient<Database>,
): Promise<PlayerContent> {
	const [palettes, shapeOrder, puzzleSets] = await Promise.all([
		loadPalettes(client),
		loadShapeOrder(client),
		loadPuzzleSets(client),
	])
	const order = shapeOrder.length ? shapeOrder : [supportedGridShapes[0].id]
	return {
		palettes,
		// A guest starts with the first shape; later shapes are earned with an account.
		unlockedShapes: [order[0]],
		puzzleSets: sortSets(puzzleSets, order),
	}
}
