import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/lib/supabase'
import { readPalette } from './palettes'

export type PaletteSetKind = 'undecided' | 'core' | 'reward' | 'paid'
export const paletteSetLabels: Record<PaletteSetKind, string> = {
	undecided: 'Undecided',
	core: 'Core',
	reward: 'Reward',
	paid: 'Pack',
}
export interface PaletteSet {
	readonly row: Tables<'palette_packs'>
	readonly kind: PaletteSetKind
	readonly members: readonly {
		readonly id: string
		readonly name: string
		readonly colors: readonly string[]
	}[]
}

export async function loadPaletteSets(
	client: SupabaseClient<Database>,
): Promise<PaletteSet[]> {
	const rows: (Tables<'palette_packs'> & { kind: PaletteSetKind })[] = []
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
	const members = new Map<string, PaletteSet['members'][number][]>()
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
			list.push(readPalette(member.palettes))
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

export type PaletteSetAction =
	| {
			readonly kind: 'create' | 'update'
			readonly name: string
			readonly role: PaletteSetKind
	  }
	| {
			readonly kind: 'assign' | 'remove' | 'reorder'
			readonly paletteIds: readonly string[]
	  }
	| { readonly kind: 'delete' }

export async function managePaletteSet(
	client: SupabaseClient<Database>,
	id: string,
	action: PaletteSetAction,
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
