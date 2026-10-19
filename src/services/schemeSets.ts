import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/types/database'
import { readColorScheme } from './colorSchemes'

export type SchemeSetKind = 'undecided' | 'core' | 'reward' | 'paid'
export const schemeSetLabels: Record<SchemeSetKind, string> = {
	undecided: 'Undecided',
	core: 'Core',
	reward: 'Reward',
	paid: 'Pack',
}
export interface SchemeSet {
	readonly row: Tables<'palette_packs'>
	readonly kind: SchemeSetKind
	readonly members: readonly {
		readonly id: string
		readonly name: string
		readonly colors: readonly string[]
	}[]
}

export async function loadSchemeSets(
	client: SupabaseClient<Database>,
): Promise<SchemeSet[]> {
	const rows: (Tables<'palette_packs'> & { kind: SchemeSetKind })[] = []
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await client
			.from('palette_packs')
			.select('*')
			.order('id')
			.range(offset, offset + 999)
		if (error)
			throw new Error(`Unable to load palette sets: ${error.message}`)
		if (!data) throw new Error('The palette set catalog returned no data.')
		for (const row of data) {
			const kind = row.kind
			if (
				kind !== 'undecided' &&
				kind !== 'core' &&
				kind !== 'reward' &&
				kind !== 'paid'
			)
				throw new Error(
					`Palette set "${row.name}" has an unsupported label.`,
				)
			rows.push({ ...row, kind })
		}
		if (data.length < 1000) break
	}
	const members = new Map<string, SchemeSet['members'][number][]>()
	for (let start = 0; rows.length > 0; start += 1000) {
		const result = await client
			.from('palette_pack_palettes')
			.select('pack_id, position, palettes(id, name, colors)')
			.order('pack_id')
			.order('position')
			.range(start, start + 999)
		if (result.error)
			throw new Error(
				`Unable to load palette set members: ${result.error.message}`,
			)
		if (!result.data)
			throw new Error('The palette membership query returned no data.')
		for (const member of result.data) {
			if (!member.palettes)
				throw new Error(
					'A palette set member could not be resolved. Refresh the catalog.',
				)
			const list = members.get(member.pack_id) ?? []
			list.push(readColorScheme(member.palettes))
			members.set(member.pack_id, list)
		}
		if (result.data.length < 1000) break
	}
	return rows
		.map(row => ({
			row,
			kind: row.kind,
			members: members.get(row.id) ?? [],
		}))
		.sort((a, b) => a.row.name.localeCompare(b.row.name))
}

export type SchemeSetAction =
	| {
			readonly kind: 'create' | 'update'
			readonly name: string
			readonly role: SchemeSetKind
	  }
	| {
			readonly kind: 'assign' | 'remove' | 'reorder'
			readonly paletteIds: readonly string[]
	  }
	| { readonly kind: 'delete' }

export async function manageSchemeSet(
	client: SupabaseClient<Database>,
	id: string,
	action: SchemeSetAction,
): Promise<void> {
	const { data, error } = await client.rpc('manage_palette_set', {
		p_id: id,
		p_action: action.kind,
		...('name' in action
			? { p_name: action.name.trim(), p_kind: action.role }
			: {}),
		...('paletteIds' in action
			? { p_palette_ids: [...action.paletteIds] }
			: {}),
	})
	if (error) throw new Error(`Unable to manage palette set: ${error.message}`)
	if (data !== id)
		throw new Error(
			'The palette set change was not confirmed. Refresh before retrying.',
		)
}
