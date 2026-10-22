import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/lib/supabase'
import type { AuthoredPuzzle } from '@/domain/puzzles'
import { PUZZLE_SHAPE_IDS, readAuthoredPuzzle } from '@/domain/puzzles'
import {
	isPuzzleGroupPurpose,
	isPuzzleGroupTrack,
	type PuzzleGroupPurpose,
	type PuzzleGroupTrack,
} from './groupDetails'
import { puzzleDraftArgs } from './puzzleDrafts'

export interface LibraryDraft {
	readonly row: Tables<'puzzles'>
	readonly assigned: boolean
	readonly groupId: string | null
	readonly groupName: string | null
	readonly groupPosition: number | null
	readonly groupPurpose: PuzzleGroupPurpose | null
	readonly groupTrack: PuzzleGroupTrack | null
	readonly puzzle: AuthoredPuzzle
}

async function loadLibrary(
	client: SupabaseClient<Database>,
	prepared: boolean,
): Promise<LibraryDraft[]> {
	const drafts: LibraryDraft[] = []
	const noun = prepared ? 'scheduled and live puzzles' : 'drafts'
	for (let offset = 0; ; offset += 1000) {
		const query = client
			.from('puzzles')
			.select(
				'*, puzzle_authoring(*), puzzle_group_members(puzzle_id, group_id, position, puzzle_groups(name, purpose, track)), daily_puzzles(id)',
			)
			.in('shape_id', [...PUZZLE_SHAPE_IDS])
		const { data, error } = await (
			prepared
				? query.not('published_at', 'is', null)
				: query.is('published_at', null)
		)
			.order('id')
			.range(offset, offset + 999)
		if (error) throw new Error(`Unable to load ${noun}: ${error.message}`)
		if (!data) throw new Error(`The library returned no ${noun}.`)
		for (const row of data) {
			const member = row.puzzle_group_members
			if (member && !member.puzzle_groups)
				throw new Error(
					'A puzzle group assignment could not be resolved. Refresh the catalog.',
				)
			const purpose = member?.puzzle_groups?.purpose ?? null
			if (purpose !== null && !isPuzzleGroupPurpose(purpose))
				throw new Error(
					`Puzzle group "${member?.puzzle_groups?.name}" has an unsupported purpose.`,
				)
			const track = member?.puzzle_groups?.track ?? null
			if (track !== null && !isPuzzleGroupTrack(track))
				throw new Error(
					`Puzzle group "${member?.puzzle_groups?.name}" has an unsupported track.`,
				)
			drafts.push({
				row,
				assigned: member !== null || row.daily_puzzles !== null,
				groupId: member?.group_id ?? null,
				groupName: member?.puzzle_groups?.name ?? null,
				groupPosition: member?.position ?? null,
				groupPurpose: purpose,
				groupTrack: track,
				puzzle: readAuthoredPuzzle(row, row.puzzle_authoring),
			})
		}
		if (data.length < 1000)
			return drafts.sort((a, b) => a.row.name.localeCompare(b.row.name))
	}
}

export function loadPuzzleDrafts(
	client: SupabaseClient<Database>,
): Promise<LibraryDraft[]> {
	return loadLibrary(client, false)
}

// Puzzles that are scheduled or live, shaped like drafts so the same editor can open them.
export function loadPreparedPuzzles(
	client: SupabaseClient<Database>,
): Promise<LibraryDraft[]> {
	return loadLibrary(client, true)
}

export async function editPuzzleDraft(
	client: SupabaseClient<Database>,
	id: string,
	name: string,
	paletteId: string,
): Promise<void> {
	const { data, error } = await client.rpc('edit_puzzle_draft', {
		p_id: id,
		p_name: name.trim(),
		p_palette_id: paletteId,
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

export async function replacePuzzleDraft(
	client: SupabaseClient<Database>,
	id: string,
	name: string,
	puzzle: AuthoredPuzzle,
): Promise<void> {
	const { data, error } = await client.rpc(
		'replace_puzzle_draft',
		puzzleDraftArgs(id, name, puzzle),
	)
	if (error) throw new Error(`Unable to replace draft: ${error.message}`)
	if (data !== id) throw new Error('The draft replacement was not confirmed.')
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
