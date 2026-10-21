import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/lib/supabase'
import { isPaletteGroupPurpose, type PaletteGroupPurpose } from './groupDetails'
import { readPalette } from './palettes'

export interface PaletteGroup {
	readonly row: Tables<'palette_groups'>
	readonly purpose: PaletteGroupPurpose
	readonly members: readonly {
		readonly id: string
		readonly name: string
		readonly colors: readonly string[]
	}[]
}

export async function loadPaletteGroups(
	client: SupabaseClient<Database>,
): Promise<PaletteGroup[]> {
	const rows: (Tables<'palette_groups'> & {
		purpose: PaletteGroupPurpose
	})[] = []
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await client
			.from('palette_groups')
			.select('*')
			.order('id')
			.range(offset, offset + 999)
		if (error)
			throw new Error(`Unable to load palette groups: ${error.message}`)
		if (!data)
			throw new Error('The palette group catalog returned no data.')
		for (const row of data) {
			const purpose = row.purpose
			if (!isPaletteGroupPurpose(purpose))
				throw new Error(
					`Palette group "${row.name}" has an unsupported purpose.`,
				)
			rows.push({ ...row, purpose })
		}
		if (data.length < 1000) break
	}
	const members = new Map<string, PaletteGroup['members'][number][]>()
	for (let start = 0; rows.length > 0; start += 1000) {
		const result = await client
			.from('palette_group_members')
			.select('group_id, position, palettes(id, name, colors)')
			.order('group_id')
			.order('position')
			.range(start, start + 999)
		if (result.error)
			throw new Error(
				`Unable to load palette group members: ${result.error.message}`,
			)
		if (!result.data)
			throw new Error('The palette membership query returned no data.')
		for (const member of result.data) {
			if (!member.palettes)
				throw new Error(
					'A palette group member could not be resolved. Refresh the catalog.',
				)
			const list = members.get(member.group_id) ?? []
			list.push(readPalette(member.palettes))
			members.set(member.group_id, list)
		}
		if (result.data.length < 1000) break
	}
	return rows
		.map(row => ({
			row,
			purpose: row.purpose,
			members: members.get(row.id) ?? [],
		}))
		.sort((a, b) => a.row.name.localeCompare(b.row.name))
}

export type PaletteGroupAction =
	| {
			readonly kind: 'create' | 'update'
			readonly name: string
			readonly purpose: PaletteGroupPurpose
	  }
	| {
			readonly kind: 'assign' | 'remove' | 'reorder'
			readonly paletteIds: readonly string[]
	  }
	| { readonly kind: 'delete' }

export async function managePaletteGroup(
	client: SupabaseClient<Database>,
	id: string,
	action: PaletteGroupAction,
): Promise<void> {
	const { data, error } = await client.rpc('manage_palette_group', {
		p_id: id,
		p_action: action.kind,
		...('name' in action
			? { p_name: action.name.trim(), p_purpose: action.purpose }
			: {}),
		...('paletteIds' in action
			? { p_palette_ids: [...action.paletteIds] }
			: {}),
	})
	if (error)
		throw new Error(`Unable to manage palette group: ${error.message}`)
	if (data !== id)
		throw new Error(
			'The palette group change was not confirmed. Refresh before retrying.',
		)
}
