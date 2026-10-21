import type { SupabaseClient } from '@supabase/supabase-js'
import { createContext, useContext, useEffect } from 'react'
import {
	loadPalettes,
	loadPuzzleDrafts,
	loadPuzzleGroups,
	loadPaletteGroups,
	loadProgression,
} from '@/features/admin/services'
import type { Database } from '@/lib/supabase'

export type Client = SupabaseClient<Database>

export const catalogLoaders = {
	puzzleGroups: (client: Client) => loadPuzzleGroups(client, true),
	puzzleDrafts: loadPuzzleDrafts,
	palettes: loadPalettes,
	paletteGroups: loadPaletteGroups,
	progression: loadProgression,
}

export type CatalogKey = keyof typeof catalogLoaders
export type CatalogData = {
	[K in CatalogKey]: Awaited<ReturnType<(typeof catalogLoaders)[K]>>
}

export interface CatalogEntry<K extends CatalogKey> {
	readonly data?: CatalogData[K]
	readonly error?: unknown
	readonly pending: boolean
}
export type CatalogEntries = { readonly [K in CatalogKey]?: CatalogEntry<K> }

export interface AdminCatalog {
	readonly entries: CatalogEntries
	readonly ensure: (key: CatalogKey, client: Client) => void
	readonly load: <K extends CatalogKey>(
		key: K,
		client: Client,
	) => Promise<CatalogData[K]>
	readonly update: <K extends CatalogKey>(
		key: K,
		next: (data: CatalogData[K]) => CatalogData[K],
	) => void
	readonly invalidate: (...keys: CatalogKey[]) => void
}

export const AdminCatalogContext = createContext<AdminCatalog | null>(null)

function useCatalogContext() {
	const context = useContext(AdminCatalogContext)
	if (!context)
		throw new Error('Admin catalog hooks require an AdminCatalogProvider.')
	return context
}

export function useCatalog<K extends CatalogKey>(
	key: K,
	client: Client,
	enabled = true,
) {
	const { entries, ensure, load, update } = useCatalogContext()
	const entry = entries[key] as CatalogEntry<K> | undefined
	useEffect(() => {
		if (enabled) ensure(key, client)
	}, [enabled, ensure, key, client])
	return {
		data: entry?.data,
		error: entry?.error,
		loading:
			enabled &&
			(entry?.pending ?? (entry?.data === undefined && !entry?.error)),
		refreshing: !!entry?.pending && entry.data !== undefined,
		refresh: () => load(key, client),
		update: (next: (data: CatalogData[K]) => CatalogData[K]) =>
			update(key, next),
	}
}

export function useCatalogInvalidation() {
	return useCatalogContext().invalidate
}
