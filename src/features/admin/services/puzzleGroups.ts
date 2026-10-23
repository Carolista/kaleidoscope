import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/lib/supabase'
import type { Puzzle, PuzzleShapeId } from '@/domain/puzzles'
import { readAuthoredPuzzle, renderAuthoredPuzzle } from '@/domain/puzzles'
import {
	isPuzzleGroupPurpose,
	isPuzzleGroupTrack,
	type PuzzleGroupPurpose,
	type PuzzleGroupTrack,
} from './groupDetails'
import { readPalette } from './palettes'

export interface PuzzleGroup {
	readonly preview: Puzzle | null
	readonly row: Tables<'puzzle_groups'>
	readonly purpose: PuzzleGroupPurpose
	readonly track: PuzzleGroupTrack | null
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

async function loadGroupMembers(
	client: SupabaseClient<Database>,
	groupIds: readonly string[],
) {
	const pages = await Promise.all(
		chunks(groupIds).map(async ids => {
			const rows = []
			for (let start = 0; ; start += 1000) {
				const result = await client
					.from('puzzle_group_members')
					.select('group_id, puzzle_id, position, puzzles(name)')
					.in('group_id', ids)
					.order('group_id')
					.order('position')
					.range(start, start + 999)
				if (result.error)
					throw new Error(
						`Unable to load group members: ${result.error.message}`,
					)
				if (!result.data)
					throw new Error(
						'The group membership query returned no data.',
					)
				rows.push(...result.data)
				if (result.data.length < 1000) return rows
			}
		}),
	)
	const members = new Map<string, PuzzleGroup['members'][number][]>()
	for (const member of pages.flat()) {
		if (!member.puzzles)
			throw new Error(
				'A group member is missing its puzzle. Refresh the catalog.',
			)
		const list = members.get(member.group_id) ?? []
		list.push({
			puzzleId: member.puzzle_id,
			name: member.puzzles.name,
			position: member.position,
			preview: null,
		})
		members.set(member.group_id, list)
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
					`Unable to load group preview: ${result.error.message}`,
				)
			if (!result.data)
				throw new Error('The group preview query returned no data.')
			return result.data
		}),
	)
	const previews = new Map<string, Puzzle>()
	for (const row of pages.flat()) {
		if (!row.palettes)
			throw new Error('The group preview or its palette is unavailable.')
		previews.set(
			row.id,
			renderAuthoredPuzzle(
				readAuthoredPuzzle(row, row.puzzle_authoring),
				readPalette(row.palettes),
			),
		)
	}
	for (const id of puzzleIds)
		if (!previews.has(id))
			throw new Error('The group preview or its palette is unavailable.')
	return previews
}

export async function loadPuzzleGroups(
	client: SupabaseClient<Database>,
	withPreviews = false,
): Promise<PuzzleGroup[]> {
	const rows: (Tables<'puzzle_groups'> & {
		purpose: PuzzleGroupPurpose
		track: PuzzleGroupTrack | null
	})[] = []
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await client
			.from('puzzle_groups')
			.select('*')
			.order('id')
			.range(offset, offset + 999)
		if (error)
			throw new Error(`Unable to load puzzle groups: ${error.message}`)
		if (!data) throw new Error('The puzzle group catalog returned no data.')
		for (const row of data) {
			const { purpose, track } = row
			if (
				!isPuzzleGroupPurpose(purpose) ||
				(track !== null && !isPuzzleGroupTrack(track))
			)
				throw new Error(
					`Puzzle group "${row.name}" has an unsupported purpose or track.`,
				)
			rows.push({ ...row, purpose, track })
		}
		if (data.length < 1000) break
	}
	const members = await loadGroupMembers(
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
			return {
				row,
				purpose: row.purpose,
				track: row.track,
				members: list,
				preview: list[0]?.preview ?? null,
			}
		})
		.sort((a, b) => a.row.name.localeCompare(b.row.name))
}

export interface PuzzleGroupDetails {
	readonly purpose: PuzzleGroupPurpose
	// Null only for daily groups, which can mix shapes.
	readonly shape: PuzzleShapeId | null
	readonly track: PuzzleGroupTrack | null
}

export type PuzzleGroupAction =
	| {
			readonly kind: 'create' | 'update'
			readonly name: string
			readonly details: PuzzleGroupDetails
	  }
	| {
			readonly kind: 'append' | 'remove' | 'reorder'
			readonly puzzleIds: readonly string[]
	  }
	| { readonly kind: 'delete' }

export async function managePuzzleGroup(
	client: SupabaseClient<Database>,
	id: string,
	action: PuzzleGroupAction,
): Promise<void> {
	const { data, error } = await client.rpc('manage_puzzle_group', {
		p_id: id,
		p_action: action.kind,
		...('name' in action
			? {
					p_name: action.name.trim(),
					p_purpose: action.details.purpose,
					...(action.details.shape
						? { p_shape_id: action.details.shape }
						: {}),
					...(action.details.track
						? { p_track: action.details.track }
						: {}),
				}
			: {}),
		...('puzzleIds' in action
			? { p_puzzle_ids: [...action.puzzleIds] }
			: {}),
	})
	if (error)
		throw new Error(`Unable to update puzzle group: ${error.message}`)
	if (data !== id)
		throw new Error('The puzzle group update was not confirmed.')
}
