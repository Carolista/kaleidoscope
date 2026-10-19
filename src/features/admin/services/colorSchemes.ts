import type { SupabaseClient } from '@supabase/supabase-js'
import type { ColorScheme } from '@/types/colorScheme'
import type { Database, Tables } from '@/types/database'
import type { AuthoringPalette } from '@/domain/puzzles'

export type CatalogScheme = Omit<Tables<'palettes'>, 'colors'> & ColorScheme

export function readColorScheme(row: {
	readonly id: string
	readonly name: string
	readonly colors: readonly string[]
}): AuthoringPalette {
	const [a, b, c, d, e] = row.colors
	if (
		row.colors.length !== 5 ||
		!a ||
		!b ||
		!c ||
		!d ||
		!e ||
		row.colors.some(color => !/^#[0-9a-f]{6}$/i.test(color))
	) {
		throw new Error(
			`Palette "${row.name}" must contain five six-digit hex colors.`,
		)
	}
	return { id: row.id, name: row.name, colors: [a, b, c, d, e] }
}

export async function loadColorSchemes(
	client: SupabaseClient<Database>,
): Promise<CatalogScheme[]> {
	const schemes: CatalogScheme[] = []
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await client
			.from('palettes')
			.select('*')
			.order('id')
			.range(offset, offset + 999)
		if (error) throw new Error(`Unable to load palettes: ${error.message}`)
		if (!data) throw new Error('The palette catalog returned no data.')
		for (const row of data)
			schemes.push({ ...row, ...readColorScheme(row) })
		if (data.length < 1000)
			return schemes.sort((a, b) => a.name.localeCompare(b.name))
	}
}

export type SchemeAction =
	| {
			readonly kind: 'create'
			readonly id: string
			readonly scheme: ColorScheme
	  }
	| {
			readonly kind: 'update'
			readonly previous: CatalogScheme
			readonly scheme: ColorScheme
	  }
	| { readonly kind: 'delete'; readonly previous: CatalogScheme }

export async function manageColorScheme(
	client: SupabaseClient<Database>,
	action: SchemeAction,
): Promise<void> {
	const id = action.kind === 'create' ? action.id : action.previous.id
	if (!id.trim() || id !== id.trim())
		throw new Error('A permanent palette ID is required.')
	if (action.kind !== 'delete') {
		if (!action.scheme.name.trim())
			throw new Error('Enter a name for the palette.')
		readColorScheme({ id, ...action.scheme })
	}
	if (action.kind === 'delete') {
		const { data, error } = await client.rpc('delete_palette_draft', {
			p_id: id,
			p_expected_name: action.previous.name,
			p_expected_colors: [...action.previous.colors],
			p_expected_revision: action.previous.revision,
		})
		if (error) throw new Error(`Unable to delete palette: ${error.message}`)
		if (data !== id)
			throw new Error(
				'The palette change was not confirmed. Refresh the catalog before retrying.',
			)
		return
	}
	const { data, error } = await client.rpc('manage_palette_draft', {
		p_id: id,
		p_action: action.kind,
		p_name: action.scheme.name.trim(),
		p_colors: [...action.scheme.colors],
		...(action.kind !== 'create'
			? {
					p_expected_name: action.previous.name,
					p_expected_colors: [...action.previous.colors],
					p_expected_revision: action.previous.revision,
				}
			: {}),
	})
	if (error)
		throw new Error(`Unable to ${action.kind} palette: ${error.message}`)
	if (data !== id)
		throw new Error(
			'The palette change was not confirmed. Refresh the catalog before retrying.',
		)
}

export async function bulkDeleteColorSchemes(
	client: SupabaseClient<Database>,
	ids: readonly string[],
): Promise<void> {
	const { data, error } = await client.rpc('bulk_delete_palette_drafts', {
		p_ids: [...ids],
	})
	if (error) throw new Error(`Unable to delete palettes: ${error.message}`)
	if (
		!data ||
		data.length !== ids.length ||
		new Set(data).size !== ids.length ||
		ids.some(id => !data.includes(id))
	)
		throw new Error(
			'The deletion was not confirmed. Refresh the catalog before retrying.',
		)
}
