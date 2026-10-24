import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { getGuestClient } from '@/lib/supabase'
import { Button, Loading } from '@/ui/components'
import { cacheContent, readCachedContent } from './contentCache'
import { loadPlayerContent } from './loadPlayerContent'
import type { PlayerContent } from './playerContent'
import { PlayerProgressProvider } from './PlayerProgressProvider'
import styles from './PlayerContentProvider.module.css'

type LoadState =
	| { readonly status: 'loading' }
	| { readonly status: 'ready'; readonly content: PlayerContent }
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

const loadFromDatabase = () => loadPlayerContent(getGuestClient())

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
export function PlayerContentProvider({
	children,
	load = loadFromDatabase,
	gate: renderGate,
}: {
	readonly children: ReactNode
	readonly load?: () => Promise<PlayerContent>
	readonly gate?: (gate: ContentGate) => ReactNode
}) {
	const [state, setState] = useState<LoadState>({ status: 'loading' })
	const [attempt, setAttempt] = useState(0)
	const retry = useCallback(() => {
		setState({ status: 'loading' })
		setAttempt(value => value + 1)
	}, [])

	useEffect(() => {
		let current = true
		const finish = (next: LoadState) => {
			if (current) setState(next)
		}
		void Promise.resolve()
			.then(load)
			.then(
				content => {
					cacheContent(content)
					finish({ status: 'ready', content })
				},
				(cause: unknown) => {
					const cached = readCachedContent()
					finish(
						cached
							? { status: 'ready', content: cached }
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
	}, [load, attempt])

	if (state.status === 'ready' && state.content.palettes.length > 0)
		return (
			<PlayerProgressProvider content={state.content}>
				{children}
			</PlayerProgressProvider>
		)

	const gate: ContentGate =
		state.status === 'loading'
			? { status: 'loading' }
			: state.status === 'failed'
				? { status: 'failed', message: state.message, retry }
				: { status: 'empty', retry }
	if (renderGate) return renderGate(gate)
	return (
		<div
			className={`${styles.gate}${isLightPage() ? ` ${styles.light}` : ''}`}
		>
			<ContentGateView gate={gate} />
		</div>
	)
}
