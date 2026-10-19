import type { SupabaseClient } from '@supabase/supabase-js'
import {
	generateAuthoredHexPuzzle,
	type AuthoredHexPuzzle,
} from '@/puzzles/hexAuthoring'
import type { HexPuzzleRecipe } from '@/puzzles/hexPuzzle'
import { createUnusedPuzzleSeed } from '@/puzzles/puzzleSeed'
import type { Database } from '@/types/database'

export type PuzzleUsage = 'collection' | 'daily'
export type DraftArgs =
	Database['public']['Functions']['save_hex_puzzle_draft']['Args']

export function puzzleDraftArgs(
	id: string,
	name: string,
	usage: PuzzleUsage,
	puzzle: AuthoredHexPuzzle,
): DraftArgs {
	return {
		p_id: id,
		p_name: name.trim(),
		p_usage: usage,
		p_palette_id: puzzle.paletteId,
		p_board_size: puzzle.recipe.size,
		p_rotation_allowed: puzzle.recipe.rotation,
		p_difficulty: puzzle.recipe.difficulty,
		p_definition: {
			version: puzzle.definition.version,
			geometry: { ...puzzle.definition.geometry },
			target: { ...puzzle.definition.target },
			pieces: puzzle.definition.pieces.map(piece => ({
				id: piece.id,
				tiles: piece.tiles.map(tile => ({ ...tile })),
			})),
		},
		p_seed: puzzle.seed,
		p_generator_version: puzzle.generatorVersion,
		p_known_solution: Object.fromEntries(
			Object.entries(puzzle.knownSolution).map(([id, placement]) => [
				id,
				{ ...placement },
			]),
		),
	}
}

export async function loadSavedPuzzleSeeds(
	client: SupabaseClient<Database>,
	recipe: HexPuzzleRecipe,
): Promise<Set<string>> {
	const seeds = new Set<string>()
	const pageSize = 1000
	for (let offset = 0; ; offset += pageSize) {
		const { data, error } = await client
			.from('puzzle_authoring')
			.select(
				'puzzle_id, seed, puzzles!inner(shape_id, board_size, rotation_allowed, difficulty)',
			)
			.eq('puzzles.shape_id', 'hexagon')
			.eq('puzzles.board_size', recipe.size)
			.eq('puzzles.rotation_allowed', recipe.rotation)
			.eq('puzzles.difficulty', recipe.difficulty)
			.order('puzzle_id')
			.range(offset, offset + pageSize - 1)
		if (error)
			throw new Error(
				`Unable to check saved puzzle seeds: ${error.message}`,
			)
		if (!data)
			throw new Error('The saved puzzle seed query returned no data.')
		for (const row of data) seeds.add(row.seed)
		if (data.length < pageSize) return seeds
	}
}

export async function savePuzzleDraft(
	client: SupabaseClient<Database>,
	args: DraftArgs,
): Promise<string> {
	const { data, error } = await client.rpc('save_hex_puzzle_draft', args)
	if (error) throw new Error(`Unable to save the draft: ${error.message}`)
	if (data !== args.p_id)
		throw new Error('The draft save did not return the expected puzzle ID.')
	return data
}

export async function generateDraftPreview(
	client: SupabaseClient<Database>,
	recipe: HexPuzzleRecipe,
	paletteId: string,
	previewedSeeds: Map<string, Set<string>>,
): Promise<AuthoredHexPuzzle> {
	const recipeKey = `hexagon:${recipe.id}`
	const excluded = await loadSavedPuzzleSeeds(client, recipe)
	for (const seed of previewedSeeds.get(recipeKey) ?? []) excluded.add(seed)
	const seed = createUnusedPuzzleSeed(excluded)
	const puzzle = generateAuthoredHexPuzzle(seed, paletteId, recipe)
	const previewed = previewedSeeds.get(recipeKey) ?? new Set<string>()
	previewed.add(seed)
	previewedSeeds.set(recipeKey, previewed)
	return puzzle
}
