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

function isLightPage() {
	return /255,\s*255,\s*255/.test(
		document.documentElement.style.backgroundColor,
	)
}

const loadFromDatabase = () => loadPlayerContent(getGuestClient())

// Loads what players may use before the app starts, falling back to the last
// successful load when the network is unavailable.
export function PlayerContentProvider({
	children,
	load = loadFromDatabase,
}: {
	readonly children: ReactNode
	readonly load?: () => Promise<PlayerContent>
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

	const gate = `${styles.gate}${isLightPage() ? ` ${styles.light}` : ''}`
	if (state.status === 'loading')
		return (
			<div className={gate}>
				<Loading label="Loading Kaleidoscope…" variant="section" />
			</div>
		)
	if (state.status === 'failed')
		return (
			<div className={gate} role="alert">
				<p>Kaleidoscope could not load its puzzles and palettes.</p>
				<p>{state.message}</p>
				<Button onClick={retry}>Try again</Button>
			</div>
		)
	if (!state.content.palettes.length)
		return (
			<div className={gate} role="status">
				<p>
					Kaleidoscope is almost ready. Nothing has been released yet.
				</p>
				<Button onClick={retry}>Check again</Button>
			</div>
		)
	return (
		<PlayerProgressProvider content={state.content}>
			{children}
		</PlayerProgressProvider>
	)
}
