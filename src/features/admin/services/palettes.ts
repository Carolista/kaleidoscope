import type { SupabaseClient } from '@supabase/supabase-js'
import type { Palette } from '@/domain/palettes'
import type { Database, Tables } from '@/lib/supabase'
import type { AuthoringPalette } from '@/domain/puzzles'

export type CatalogPalette = Omit<Tables<'palettes'>, 'colors'> & Palette

export function readPalette(row: {
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

export async function loadPalettes(
	client: SupabaseClient<Database>,
): Promise<CatalogPalette[]> {
	const palettes: CatalogPalette[] = []
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await client
			.from('palettes')
			.select('*')
			.order('id')
			.range(offset, offset + 999)
		if (error) throw new Error(`Unable to load palettes: ${error.message}`)
		if (!data) throw new Error('The palette catalog returned no data.')
		for (const row of data) palettes.push({ ...row, ...readPalette(row) })
		if (data.length < 1000)
			return palettes.sort((a, b) => a.name.localeCompare(b.name))
	}
}

export type PaletteAction =
	| {
			readonly kind: 'create'
			readonly id: string
			readonly palette: Palette
	  }
	| {
			readonly kind: 'update'
			readonly previous: CatalogPalette
			readonly palette: Palette
	  }
	| { readonly kind: 'delete'; readonly previous: CatalogPalette }

export async function managePalette(
	client: SupabaseClient<Database>,
	action: PaletteAction,
): Promise<void> {
	const id = action.kind === 'create' ? action.id : action.previous.id
	if (!id.trim() || id !== id.trim())
		throw new Error('A permanent palette ID is required.')
	if (action.kind !== 'delete') {
		if (!action.palette.name.trim())
			throw new Error('Enter a name for the palette.')
		readPalette({ id, ...action.palette })
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
		p_name: action.palette.name.trim(),
		p_colors: [...action.palette.colors],
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

export async function bulkDeletePalettes(
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
