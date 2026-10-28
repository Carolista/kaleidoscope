import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { getGuestClient, getPlayerClient } from '@/lib/supabase'
import { Button, Loading } from '@/ui/components'
import {
	supabaseAccountProgress,
	type AccountProgressApi,
} from './accountProgress'
import { cacheContent, readCachedContent } from './contentCache'
import { loadPlayerContent } from './loadPlayerContent'
import type { PlayerContent } from './playerContent'
import {
	PlayerProgressProvider,
	type AccountSnapshot,
} from './PlayerProgressProvider'
import { loadAccountProgressCache } from './solvedPuzzles'
import styles from './PlayerContentProvider.module.css'

// What one load produced, and for whom: `userId` is null for a guest.
interface Loaded {
	readonly userId: string | null
	readonly content: PlayerContent
	readonly solved: readonly string[]
}

type LoadState =
	| { readonly status: 'loading' }
	| { readonly status: 'ready'; readonly loaded: Loaded }
	| { readonly status: 'failed'; readonly message: string }

// What stands in for the app until it has content to show.
export type ContentGate =
	| { readonly status: 'loading' }
	| {
			readonly status: 'failed'
			readonly message: string
			readonly retry: () => void
	  }
	| { readonly status: 'empty'; readonly retry: () => void }

function isLightPage() {
	return /255,\s*255,\s*255/.test(
		document.documentElement.style.backgroundColor,
	)
}

// A signed-in player reads with their own session, so the database shows what their
// progress has opened (later shapes, earned bonus sets); a guest reads as a guest.
const loadFromDatabase = (userId: string | null) =>
	userId
		? loadPlayerContent(getPlayerClient(), { account: { userId } })
		: loadPlayerContent(getGuestClient())

// Resolved when used, so a build without Supabase only fails when an account is in play.
const databaseProgress: AccountProgressApi = {
	loadSolved: userId =>
		supabaseAccountProgress(getPlayerClient()).loadSolved(userId),
	record: ids => supabaseAccountProgress(getPlayerClient()).record(ids),
}

// The loading, failure, and nothing-released messages. Used on its own page by
// default, or inside the app's own frame where `gate` is supplied.
export function ContentGateView({ gate }: { readonly gate: ContentGate }) {
	if (gate.status === 'loading')
		return <Loading label="Loading Kaleidoscope…" variant="section" />
	if (gate.status === 'failed')
		return (
			<div className={styles.message} role="alert">
				<p>Kaleidoscope could not load its puzzles and palettes.</p>
				<p>{gate.message}</p>
				<Button onClick={gate.retry}>Try again</Button>
			</div>
		)
	return (
		<div className={styles.message} role="status">
			<p>Kaleidoscope is almost ready. Nothing has been released yet.</p>
			<Button onClick={gate.retry}>Check again</Button>
		</div>
	)
}

// Loads what players may use before the app can show it, falling back to the last
// successful load when the network is unavailable. Until then it shows `gate`
// (by default a page of its own), so the app's frame can appear straight away.
// Content depends on who is playing: it waits for the account to be known, and when the
// player signs in or out it loads for the new player while the app stays on screen.
export function PlayerContentProvider({
	children,
	load = loadFromDatabase,
	progress = databaseProgress,
	userId = null,
	accountResolved = true,
	gate: renderGate,
}: {
	readonly children: ReactNode
	readonly load?: (userId: string | null) => Promise<PlayerContent>
	readonly progress?: AccountProgressApi
	// The signed-in player, if any.
	readonly userId?: string | null
	// False while it is still unknown whether someone is signed in.
	readonly accountResolved?: boolean
	readonly gate?: (gate: ContentGate) => ReactNode
}) {
	const [state, setState] = useState<LoadState>({ status: 'loading' })
	const [attempt, setAttempt] = useState(0)
	const retry = useCallback(() => {
		setState({ status: 'loading' })
		setAttempt(value => value + 1)
	}, [])

	const fetchLoaded = useCallback(
		async (forUser: string | null): Promise<Loaded> => {
			const [content, solved] = await Promise.all([
				load(forUser),
				forUser ? progress.loadSolved(forUser) : [],
			])
			cacheContent(content, forUser)
			return { userId: forUser, content, solved }
		},
		[load, progress],
	)

	useEffect(() => {
		if (!accountResolved) return
		let current = true
		const finish = (next: LoadState) => {
			if (current) setState(next)
		}
		void fetchLoaded(userId).then(
			loaded => finish({ status: 'ready', loaded }),
			(cause: unknown) => {
				const cached = readCachedContent(userId)
				finish(
					cached
						? {
								status: 'ready',
								loaded: {
									userId,
									content: cached,
									solved: userId
										? [
												...loadAccountProgressCache(
													userId,
												).solved,
											]
										: [],
								},
							}
						: {
								status: 'failed',
								message:
									cause instanceof Error && cause.message
										? cause.message
										: 'Unable to load puzzles.',
							},
				)
			},
		)
		return () => {
			current = false
		}
	}, [fetchLoaded, userId, accountResolved, attempt])

	// Reloads for the current player, for when their progress may have opened something.
	const reload = useCallback(async (): Promise<AccountSnapshot | null> => {
		if (!userId) return null
		try {
			const loaded = await fetchLoaded(userId)
			setState(previous =>
				previous.status === 'ready' && previous.loaded.userId === userId
					? { status: 'ready', loaded }
					: previous,
			)
			return { content: loaded.content, solved: loaded.solved }
		} catch {
			return null
		}
	}, [fetchLoaded, userId])

	const loaded = state.status === 'ready' ? state.loaded : null
	const account = loaded?.userId
		? {
				userId: loaded.userId,
				solved: loaded.solved,
				api: progress,
				reload,
			}
		: undefined

	if (loaded && loaded.content.palettes.length > 0)
		return (
			<PlayerProgressProvider content={loaded.content} account={account}>
				{children}
			</PlayerProgressProvider>
		)

	const gate: ContentGate =
		state.status === 'failed'
			? { status: 'failed', message: state.message, retry }
			: state.status === 'ready'
				? { status: 'empty', retry }
				: { status: 'loading' }
	if (renderGate) return renderGate(gate)
	return (
		<div
			className={`${styles.gate}${isLightPage() ? ` ${styles.light}` : ''}`}
		>
			<ContentGateView gate={gate} />
		</div>
	)
}
