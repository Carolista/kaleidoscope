import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import {
	AdminCatalogContext,
	catalogLoaders,
	type CatalogData,
	type CatalogEntries,
	type CatalogEntry,
	type CatalogKey,
	type Client,
} from './useAdminCatalog'

/** Session-scoped admin catalog cache; data reloads only on request or invalidation. */
export function AdminCatalogProvider({
	children,
}: {
	readonly children: ReactNode
}) {
	const [entries, setEntries] = useState<CatalogEntries>({})
	const generations = useRef(new Map<CatalogKey, number>())
	const inFlight = useRef(new Set<CatalogKey>())
	const loaded = useRef(new Map<CatalogKey, Client>())

	const patch = useCallback(
		<K extends CatalogKey>(key: K, value: Partial<CatalogEntry<K>>) =>
			setEntries(previous => ({
				...previous,
				[key]: { pending: false, ...previous[key], ...value },
			})),
		[],
	)

	const load = useCallback(
		<K extends CatalogKey>(key: K, client: Client) => {
			const generation = (generations.current.get(key) ?? 0) + 1
			generations.current.set(key, generation)
			inFlight.current.add(key)
			patch(key, { pending: true })
			const current = () => generations.current.get(key) === generation
			const loader = catalogLoaders[key] as (
				client: Client,
			) => Promise<CatalogData[K]>
			return loader(client).then(
				data => {
					if (current()) {
						inFlight.current.delete(key)
						loaded.current.set(key, client)
						patch(key, { data, error: undefined, pending: false })
					}
					return data
				},
				(cause: unknown) => {
					if (current()) {
						inFlight.current.delete(key)
						patch(key, { error: cause, pending: false })
					}
					throw cause
				},
			)
		},
		[patch],
	)

	const ensure = useCallback(
		(key: CatalogKey, client: Client) => {
			if (inFlight.current.has(key) || loaded.current.has(key)) return
			void load(key, client).catch(() => {})
		},
		[load],
	)

	const update = useCallback(
		<K extends CatalogKey>(
			key: K,
			next: (data: CatalogData[K]) => CatalogData[K],
		) => {
			// Local edits win over any older response still in flight.
			if (inFlight.current.delete(key))
				generations.current.set(
					key,
					(generations.current.get(key) ?? 0) + 1,
				)
			setEntries(previous => {
				const entry = previous[key] as CatalogEntry<K> | undefined
				if (entry?.data === undefined) return previous
				return {
					...previous,
					[key]: { ...entry, data: next(entry.data), pending: false },
				}
			})
		},
		[],
	)

	const invalidate = useCallback(
		(...keys: CatalogKey[]) => {
			for (const key of keys) {
				const client = loaded.current.get(key)
				if (client) void load(key, client).catch(() => {})
			}
		},
		[load],
	)

	const value = useMemo(
		() => ({ entries, ensure, load, update, invalidate }),
		[entries, ensure, load, update, invalidate],
	)
	return (
		<AdminCatalogContext.Provider value={value}>
			{children}
		</AdminCatalogContext.Provider>
	)
}
