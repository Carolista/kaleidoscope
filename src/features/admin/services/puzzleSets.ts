import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/lib/supabase'
import type { Puzzle } from '@/domain/puzzles'
import {
	readAuthoredHexPuzzle,
	renderAuthoredHexPuzzle,
} from '@/domain/puzzles'
import { readPalette } from './palettes'

export type SetKind = 'core' | 'reward' | 'paid'
export interface DraftSet {
	readonly preview: Puzzle | null
	readonly row: Tables<'puzzle_collections'>
	readonly members: readonly {
		readonly puzzleId: string
		readonly name: string
		readonly position: number
		readonly preview: Puzzle | null
	}[]
}

// Keeps `.in()` filters well under URL length limits.
const ID_CHUNK = 100

function chunks<T>(values: readonly T[]): T[][] {
	const result: T[][] = []
	for (let index = 0; index < values.length; index += ID_CHUNK)
		result.push(values.slice(index, index + ID_CHUNK))
	return result
}

async function loadSetMembers(
	client: SupabaseClient<Database>,
	setIds: readonly string[],
) {
	const pages = await Promise.all(
		chunks(setIds).map(async ids => {
			const rows = []
			for (let start = 0; ; start += 1000) {
				const result = await client
					.from('collection_puzzles')
					.select('collection_id, puzzle_id, position, puzzles(name)')
					.in('collection_id', ids)
					.order('collection_id')
					.order('position')
					.range(start, start + 999)
				if (result.error)
					throw new Error(
						`Unable to load set members: ${result.error.message}`,
					)
				if (!result.data)
					throw new Error(
						'The set membership query returned no data.',
					)
				rows.push(...result.data)
				if (result.data.length < 1000) return rows
			}
		}),
	)
	const members = new Map<string, DraftSet['members'][number][]>()
	for (const member of pages.flat()) {
		if (!member.puzzles)
			throw new Error(
				'A set member is missing its puzzle. Refresh the catalog.',
			)
		const list = members.get(member.collection_id) ?? []
		list.push({
			puzzleId: member.puzzle_id,
			name: member.puzzles.name,
			position: member.position,
			preview: null,
		})
		members.set(member.collection_id, list)
	}
	return members
}

async function loadPreviews(
	client: SupabaseClient<Database>,
	puzzleIds: readonly string[],
) {
	const pages = await Promise.all(
		chunks(puzzleIds).map(async ids => {
			const result = await client
				.from('puzzles')
				.select('*, puzzle_authoring(*), palettes(id, name, colors)')
				.in('id', ids)
			if (result.error)
				throw new Error(
					`Unable to load set preview: ${result.error.message}`,
				)
			if (!result.data)
				throw new Error('The set preview query returned no data.')
			return result.data
		}),
	)
	const previews = new Map<string, Puzzle>()
	for (const row of pages.flat()) {
		if (!row.palettes)
			throw new Error('The set preview or its palette is unavailable.')
		previews.set(
			row.id,
			renderAuthoredHexPuzzle(
				readAuthoredHexPuzzle(row, row.puzzle_authoring),
				readPalette(row.palettes),
			),
		)
	}
	for (const id of puzzleIds)
		if (!previews.has(id))
			throw new Error('The set preview or its palette is unavailable.')
	return previews
}

export async function loadDraftSets(
	client: SupabaseClient<Database>,
	withPreviews = false,
): Promise<DraftSet[]> {
	const rows: Tables<'puzzle_collections'>[] = []
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await client
			.from('puzzle_collections')
			.select('*')
			.eq('shape_id', 'hexagon')
			.is('published_at', null)
			.order('id')
			.range(offset, offset + 999)
		if (error)
			throw new Error(`Unable to load draft sets: ${error.message}`)
		if (!data) throw new Error('The draft set catalog returned no data.')
		rows.push(...data)
		if (data.length < 1000) break
	}
	const members = await loadSetMembers(
		client,
		rows.map(row => row.id),
	)
	const previews = withPreviews
		? await loadPreviews(client, [
				...new Set(
					[...members.values()].flatMap(list =>
						list.map(member => member.puzzleId),
					),
				),
			])
		: new Map<string, Puzzle>()
	return rows
		.map(row => {
			const list = (members.get(row.id) ?? []).map(member => ({
				...member,
				preview: previews.get(member.puzzleId) ?? null,
			}))
			return { row, members: list, preview: list[0]?.preview ?? null }
		})
		.sort((a, b) => a.row.name.localeCompare(b.row.name))
}

export type SetAction =
	| { readonly kind: 'create'; readonly name: string; readonly role: SetKind }
	| { readonly kind: 'rename'; readonly name: string }
	| {
			readonly kind: 'append' | 'remove' | 'reorder'
			readonly puzzleIds: readonly string[]
	  }

export async function deleteDraftSet(
	client: SupabaseClient<Database>,
	id: string,
): Promise<void> {
	const { data, error } = await client.rpc('delete_draft_set', { p_id: id })
	if (error) throw new Error(`Unable to delete draft set: ${error.message}`)
	if (data !== id)
		throw new Error('The draft set deletion was not confirmed.')
}

export async function manageDraftSet(
	client: SupabaseClient<Database>,
	id: string,
	action: SetAction,
): Promise<void> {
	const { data, error } = await client.rpc('manage_draft_set', {
		p_id: id,
		p_action: action.kind,
		...('name' in action ? { p_name: action.name.trim() } : {}),
		...(action.kind === 'create'
			? { p_kind: action.role, p_shape_id: 'hexagon' }
			: {}),
		...('puzzleIds' in action
			? { p_puzzle_ids: [...action.puzzleIds] }
			: {}),
	})
	if (error) throw new Error(`Unable to update draft set: ${error.message}`)
	if (data !== id) throw new Error('The draft set update was not confirmed.')
}
