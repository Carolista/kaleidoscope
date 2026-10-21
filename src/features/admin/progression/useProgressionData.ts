import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { useCatalog } from '@/features/admin/catalog'

// The catalogs every progression view reads; puzzles load only where they are needed.
export default function useProgressionData(
	client: SupabaseClient<Database>,
	includePuzzles = false,
) {
	const progression = useCatalog('progression', client)
	const paletteGroups = useCatalog('paletteGroups', client)
	const palettes = useCatalog('palettes', client)
	const puzzles = useCatalog('puzzleDrafts', client, includePuzzles)
	const sources = includePuzzles
		? [progression, paletteGroups, palettes, puzzles]
		: [progression, paletteGroups, palettes]
	return {
		progression: progression.data,
		paletteGroups: paletteGroups.data,
		palettes: palettes.data,
		puzzles: puzzles.data,
		loading: sources.some(source => source.loading),
		refreshing: sources.some(source => source.refreshing),
		error: sources.find(source => source.error)?.error,
		refresh: async () => {
			await Promise.all(sources.map(source => source.refresh()))
		},
		updateProgression: progression.update,
	}
}
