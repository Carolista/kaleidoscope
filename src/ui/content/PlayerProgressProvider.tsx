import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react'
import type { AccountProgressApi } from './accountProgress'
import type { PlayerContent } from './playerContent'
import { PlayerContentContext } from './PlayerContentContext'
import { PlayerProgressContext } from './PlayerProgressContext'
import {
	accountShapeFor,
	availableContent,
	completesSet,
	newRewards,
	newShapes,
} from './rewards'
import type { NewRewards } from './rewards'
import {
	loadAccountProgressCache,
	loadGuestImportState,
	loadSolvedPuzzles,
	saveAccountProgressCache,
	saveGuestImportState,
	saveSolvedPuzzles,
	type GuestImportState,
} from './solvedPuzzles'

const NOTHING: NewRewards = {
	palettes: [],
	bonusSets: [],
	shapes: [],
	accountShape: null,
	randomizer: false,
}
const NONE: ReadonlySet<string> = new Set()
// Returning to a tab refreshes progress at most this often.
const REFRESH_INTERVAL_MS = 30_000

// What the server returned when content was last loaded for the signed-in player.
export interface AccountSnapshot {
	readonly content: PlayerContent
	readonly solved: readonly string[]
}

interface Store {
	readonly userId: string | null
	readonly solved: ReadonlySet<string>
	// Solves the server has not confirmed yet (account only).
	readonly pending: ReadonlySet<string>
	// Guest solves on this device that the account lacks and has not been sent, and what
	// the player has already answered about them (account only).
	readonly importable: ReadonlySet<string>
	readonly importState: GuestImportState
}

function initialStore(
	userId: string | null,
	serverSolved: readonly string[],
): Store {
	if (!userId)
		return {
			userId,
			solved: loadSolvedPuzzles(),
			pending: NONE,
			importable: NONE,
			importState: { handled: NONE, declined: NONE },
		}
	const { pending } = loadAccountProgressCache(userId)
	const solved = new Set([...serverSolved, ...pending])
	const guestSolved = loadSolvedPuzzles()
	const importState = loadGuestImportState(userId)
	return {
		userId,
		solved,
		pending,
		importable: new Set(
			[...guestSolved].filter(
				id => !solved.has(id) && !importState.handled.has(id),
			),
		),
		importState,
	}
}

// Keeps the player's solved puzzles and offers the content they have earned, so every
// mode reads the same palettes and sets. A guest's solves stay on this device and are
// never merged into an account automatically. A signed-in player's solves are recorded
// on the account (kept and retried while offline), and finishing a set reloads the
// content, since that is what can open a bonus set or the next shape.
export function PlayerProgressProvider({
	content,
	account,
	children,
}: {
	readonly content: PlayerContent
	readonly account?: {
		readonly userId: string
		readonly solved: readonly string[]
		readonly api: AccountProgressApi
		readonly reload: () => Promise<AccountSnapshot | null>
	}
	readonly children: ReactNode
}) {
	const userId = account?.userId ?? null
	const api = account?.api
	const reload = account?.reload
	const [store, setStore] = useState(() =>
		initialStore(userId, account?.solved ?? []),
	)
	// A different player starts from that player's own progress, not the previous one's.
	if (store.userId !== userId)
		setStore(initialStore(userId, account?.solved ?? []))
	const solved = store.solved
	const pendingRef = useRef<Set<string>>(new Set())
	const queueRef = useRef<Promise<unknown>>(Promise.resolve())

	// Sends everything pending, one request at a time. Resolves false when the server
	// could not be reached, leaving the solves pending for a later try.
	const flush = useCallback((): Promise<boolean> => {
		if (!userId || !api) return Promise.resolve(true)
		const run = queueRef.current.then(async () => {
			const ids = [...pendingRef.current]
			if (!ids.length) return true
			try {
				await api.record(ids)
			} catch {
				return false
			}
			ids.forEach(id => pendingRef.current.delete(id))
			setStore(previous =>
				previous.userId === userId
					? { ...previous, pending: new Set(pendingRef.current) }
					: previous,
			)
			return true
		})
		queueRef.current = run
		return run
	}, [userId, api])

	// Solves only ever accumulate, so whatever the server holds joins what is known here.
	const mergeServerSolved = useCallback(
		(fresh: AccountSnapshot | null) => {
			if (!fresh) return
			setStore(previous =>
				previous.userId === userId
					? {
							...previous,
							solved: new Set([
								...previous.solved,
								...fresh.solved,
							]),
						}
					: previous,
			)
		},
		[userId],
	)

	const syncPending = useCallback(async () => {
		if (pendingRef.current.size && (await flush()))
			mergeServerSolved((await reload?.()) ?? null)
	}, [flush, reload, mergeServerSolved])

	// Picks up solves made on another device, after sending any made here.
	const refresh = useCallback(async () => {
		if (!userId || !reload || !(await flush())) return
		mergeServerSolved(await reload())
	}, [userId, reload, flush, mergeServerSolved])

	useEffect(() => {
		pendingRef.current = userId
			? new Set(loadAccountProgressCache(userId).pending)
			: new Set()
	}, [userId])

	useEffect(() => {
		void syncPending()
	}, [syncPending])

	const lastRefreshRef = useRef(0)
	useEffect(() => {
		if (!userId) return
		// Content has just loaded, so the clock starts now.
		lastRefreshRef.current = Date.now()
		const refreshNow = () => {
			lastRefreshRef.current = Date.now()
			void refresh()
		}
		const onVisible = () => {
			if (
				document.visibilityState === 'visible' &&
				Date.now() - lastRefreshRef.current > REFRESH_INTERVAL_MS
			)
				refreshNow()
		}
		window.addEventListener('online', refreshNow)
		document.addEventListener('visibilitychange', onVisible)
		return () => {
			window.removeEventListener('online', refreshNow)
			document.removeEventListener('visibilitychange', onVisible)
		}
	}, [userId, refresh])

	useEffect(() => {
		if (userId && store.userId === userId)
			saveAccountProgressCache(userId, store)
	}, [store, userId])

	const available = useMemo(
		() => availableContent(content, solved),
		[content, solved],
	)
	const markSolved = useCallback(
		async (puzzleId: string): Promise<NewRewards> => {
			if (solved.has(puzzleId)) return NOTHING
			const next = new Set(solved).add(puzzleId)
			if (!userId) {
				saveSolvedPuzzles(next)
				setStore(previous => ({ ...previous, solved: next }))
				return {
					...newRewards(content, solved, next),
					accountShape: accountShapeFor(content, solved, next),
				}
			}
			pendingRef.current.add(puzzleId)
			const pending = new Set(pendingRef.current)
			setStore(previous => ({ ...previous, solved: next, pending }))
			const saved = flush()
			if (!completesSet(content, puzzleId, next)) return NOTHING
			let current = content
			if ((await saved) && reload) {
				const fresh = await reload()
				if (fresh) {
					current = fresh.content
					mergeServerSolved(fresh)
				}
			}
			return {
				...newRewards(current, solved, next),
				shapes: newShapes(content, current),
				randomizer:
					!content.randomizerUnlocked && current.randomizerUnlocked,
			}
		},
		[content, solved, userId, flush, reload, mergeServerSolved],
	)

	const importIds = store.importable
	const declinedIds = store.importState.declined
	const runImport = useCallback(async (): Promise<boolean> => {
		if (!userId || !api) return false
		const run = queueRef.current.then(async () => {
			try {
				const recorded = await api.record([...importIds])
				const fresh = await reload?.()
				setStore(previous => {
					if (previous.userId !== userId) return previous
					const importState = {
						...previous.importState,
						handled: new Set([
							...previous.importState.handled,
							...importIds,
						]),
					}
					saveGuestImportState(userId, importState)
					return {
						...previous,
						solved: new Set([
							...previous.solved,
							...recorded,
							...(fresh?.solved ?? []),
						]),
						importable: NONE,
						importState,
					}
				})
				return true
			} catch {
				return false
			}
		})
		queueRef.current = run
		return run
	}, [userId, api, reload, importIds])
	const decline = useCallback(() => {
		if (!userId) return
		setStore(previous => {
			if (previous.userId !== userId) return previous
			const importState = {
				...previous.importState,
				declined: new Set([
					...previous.importState.declined,
					...previous.importable,
				]),
			}
			saveGuestImportState(userId, importState)
			return { ...previous, importState }
		})
	}, [userId])
	const guestImport = useMemo(
		() =>
			userId && importIds.size > 0
				? {
						count: importIds.size,
						// Opens by itself only for solves the player has not already answered.
						offered: [...importIds].some(
							id => !declinedIds.has(id),
						),
						run: runImport,
						decline,
					}
				: null,
		[userId, importIds, declinedIds, runImport, decline],
	)

	const progress = useMemo(
		() => ({ solved, markSolved, guestImport }),
		[solved, markSolved, guestImport],
	)
	return (
		<PlayerProgressContext.Provider value={progress}>
			<PlayerContentContext.Provider value={available}>
				{children}
			</PlayerContentContext.Provider>
		</PlayerProgressContext.Provider>
	)
}
