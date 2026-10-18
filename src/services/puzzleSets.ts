import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../types/database'
import type { HexPuzzle } from '../puzzles/hexPuzzle'
import { readAuthoredHexPuzzle } from '../puzzles/readAuthoredHexPuzzle'
import { renderAuthoredHexPuzzle } from '../puzzles/hexAuthoring'

export type SetKind = 'core' | 'reward' | 'paid'
export interface DraftSet {
	readonly preview: HexPuzzle | null
	readonly row: Tables<'puzzle_collections'>
	readonly members: readonly {
		readonly puzzleId: string
		readonly name: string
		readonly position: number
		readonly preview: HexPuzzle | null
	}[]
}

export async function loadDraftSets(
	client: SupabaseClient<Database>,
	withPreviews = false,
): Promise<DraftSet[]> {
	const sets: DraftSet[] = []
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
		for (const row of data) {
			const members: DraftSet['members'][number][] = []
			for (let start = 0; ; start += 1000) {
				const result = await client
					.from('collection_puzzles')
					.select('puzzle_id, position, puzzles(name)')
					.eq('collection_id', row.id)
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
				for (const member of result.data) {
					if (!member.puzzles)
						throw new Error(
							'A set member is missing its puzzle. Refresh the catalog.',
						)
					members.push({
						puzzleId: member.puzzle_id,
						name: member.puzzles.name,
						position: member.position,
						preview: null,
					})
				}
				if (result.data.length < 1000) break
			}
			for (
				let index = 0;
				withPreviews && index < members.length;
				index++
			) {
				const member = members[index]
				const result = await client
					.from('puzzles')
					.select(
						'*, puzzle_authoring(*), palettes(id, name, colors)',
					)
					.eq('id', member.puzzleId)
					.single()
				if (result.error)
					throw new Error(
						`Unable to load set preview: ${result.error.message}`,
					)
				if (!result.data?.palettes)
					throw new Error(
						'The set preview or its palette is unavailable.',
					)
				const palette = result.data.palettes
				const [a, b, c, d, e] = palette.colors
				if (
					palette.colors.length !== 5 ||
					!a ||
					!b ||
					!c ||
					!d ||
					!e ||
					palette.colors.some(color => !/^#[0-9a-f]{6}$/i.test(color))
				) {
					throw new Error(
						`Palette "${palette.name}" must contain five six-digit hex colors.`,
					)
				}
				const preview = renderAuthoredHexPuzzle(
					readAuthoredHexPuzzle(
						result.data,
						result.data.puzzle_authoring,
					),
					{ ...palette, colors: [a, b, c, d, e] },
				)
				members[index] = { ...member, preview }
			}
			sets.push({ row, members, preview: members[0]?.preview ?? null })
		}

		if (data.length < 1000)
			return sets.sort((a, b) => a.row.name.localeCompare(b.row.name))
	}
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
		...(action.kind === 'create' ? { p_kind: action.role } : {}),
		...('puzzleIds' in action
			? { p_puzzle_ids: [...action.puzzleIds] }
			: {}),
	})
	if (error) throw new Error(`Unable to update draft set: ${error.message}`)
	if (data !== id) throw new Error('The draft set update was not confirmed.')
}
