import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../types/database'
import type { AuthoredHexPuzzle } from '../puzzles/hexAuthoring'
import { readAuthoredHexPuzzle } from '../puzzles/readAuthoredHexPuzzle'
import type { PuzzleUsage } from './puzzleDrafts'

export interface LibraryDraft {
	readonly row: Tables<'puzzles'>
	readonly assigned: boolean
	readonly puzzle: AuthoredHexPuzzle
}

export async function loadPuzzleDrafts(
	client: SupabaseClient<Database>,
): Promise<LibraryDraft[]> {
	const drafts: LibraryDraft[] = []
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await client
			.from('puzzles')
			.select(
				'*, puzzle_authoring(*), collection_puzzles(puzzle_id), daily_puzzles(id)',
			)
			.eq('shape_id', 'hexagon')
			.is('published_at', null)
			.order('id')
			.range(offset, offset + 999)
		if (error) throw new Error(`Unable to load drafts: ${error.message}`)
		if (!data) throw new Error('The draft library returned no data.')
		for (const row of data) {
			drafts.push({
				row,
				assigned:
					row.collection_puzzles.length > 0 ||
					row.daily_puzzles.length > 0,
				puzzle: readAuthoredHexPuzzle(row, row.puzzle_authoring),
			})
		}
		if (data.length < 1000)
			return drafts.sort((a, b) => a.row.name.localeCompare(b.row.name))
	}
}

export async function editPuzzleDraft(
	client: SupabaseClient<Database>,
	id: string,
	name: string,
	paletteId: string,
	usage: PuzzleUsage,
): Promise<void> {
	const { data, error } = await client.rpc('edit_puzzle_draft', {
		p_id: id,
		p_name: name.trim(),
		p_palette_id: paletteId,
		p_usage: usage,
	})
	if (error) throw new Error(`Unable to update draft: ${error.message}`)
	if (data !== id) throw new Error('The draft update was not confirmed.')
}

export async function deletePuzzleDraft(
	client: SupabaseClient<Database>,
	id: string,
): Promise<void> {
	const { data, error } = await client.rpc('delete_puzzle_draft', {
		p_id: id,
	})
	if (error) throw new Error(`Unable to delete draft: ${error.message}`)
	if (data !== id) throw new Error('The draft deletion was not confirmed.')
}

export async function bulkPuzzleDrafts(
	client: SupabaseClient<Database>,
	ids: readonly string[],
	action:
		| { readonly kind: 'delete' }
		| { readonly kind: 'palette'; readonly paletteId: string },
): Promise<void> {
	const { data, error } = await client.rpc('bulk_puzzle_drafts', {
		p_ids: [...ids],
		p_action: action.kind,
		...(action.kind === 'palette'
			? { p_palette_id: action.paletteId }
			: {}),
	})
	if (error) throw new Error(`Unable to apply bulk action: ${error.message}`)
	if (
		!data ||
		data.length !== ids.length ||
		new Set(data).size !== ids.length ||
		ids.some(id => !data.includes(id))
	) {
		throw new Error(
			'The bulk action was not confirmed. Refresh the library before retrying.',
		)
	}
}
