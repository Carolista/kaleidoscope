import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { getThemeColors } from '@/domain/palettes'
import {
	AccountControl,
	AccountDialog,
	GuestImportButton,
	GuestImportDialog,
	useAccount,
} from '@/features/account'
import { HomeScreen } from '@/features/home'
import { PuzzleMode } from '@/features/puzzle'
import { hasPersistedDesign, ZenMode } from '@/features/zen'
import { DarkModeToggle } from '@/ui/components'
import type { ContentGate } from '@/ui/content'
import { ContentGateView, usePuzzleResume } from '@/ui/content'
import { usePlayerTheme } from '@/ui/theme'
import {
	markEntranceSpinFinished,
	markEntranceStarted,
	readEntranceHandoff,
} from './entranceHandoff'
import { Footer, Header, releaseOpeningTitle } from './layout'
import styles from './PlayerApp.module.css'

type Mode = 'home' | 'zen' | 'puzzle'

// Home, Puzzle Mode, and Zen. Only rendered once the player's content is ready, since
// they all read it. Puzzle Mode stays mounted while hidden so its place in a set is kept.
function Modes({
	mode,
	onModeChange,
	onSignIn,
	isFirstVisit,
	showIntro,
	onIntroComplete,
}: {
	readonly mode: Mode
	readonly onModeChange: (mode: Mode) => void
	// Set for a guest where accounts can be created.
	readonly onSignIn?: () => void
	readonly isFirstVisit: boolean
	readonly showIntro: boolean
	readonly onIntroComplete: () => void
}) {
	const account = useAccount()
	const { target } = usePuzzleResume()
	const [openRequest, setOpenRequest] = useState<{
		setId: string
		puzzleId: string
		nonce: number
	} | null>(null)

	function openPuzzle() {
		if (target)
			setOpenRequest(previous => ({
				...target,
				nonce: (previous?.nonce ?? 0) + 1,
			}))
		onModeChange('puzzle')
	}

	return (
		<>
			{mode === 'home' && (
				<HomeScreen
					signedIn={account.status === 'signedIn'}
					firstName={account.firstName}
					onSignIn={onSignIn}
					onOpenPuzzle={openPuzzle}
					onOpenZen={() => onModeChange('zen')}
					continuePuzzle={!!target}
				/>
			)}
			<PuzzleMode
				hidden={mode !== 'puzzle'}
				onOpenZen={() => onModeChange('zen')}
				returningGuest={account.returningGuest}
				onCreateAccount={onSignIn}
				openRequest={openRequest}
			/>
			{mode === 'zen' && (
				<ZenMode
					isFirstVisit={isFirstVisit}
					showIntro={showIntro}
					onIntroComplete={onIntroComplete}
				/>
			)}
		</>
	)
}

// With `gate`, the player's content is not ready yet: only the frame is shown, with
// the gate's message in place of the modes. The frame is rebuilt once content
// arrives, and carries the opening animation on from where this one got to.
function PlayerApp({ gate }: { readonly gate?: ContentGate }) {
	const { darkMode } = usePlayerTheme()
	const { base, accent } = getThemeColors(darkMode)
	const titleRef = useRef<HTMLHeadingElement>(null)
	const titleAnimationRef = useRef<Animation | null>(null)
	const entranceStartedRef = useRef(false)
	const [handoff] = useState(() => {
		if (gate) {
			markEntranceStarted()
			return null
		}
		return readEntranceHandoff()
	})
	const [canAnimateEntrance] = useState(
		() =>
			!handoff?.settled &&
			!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
			typeof Element.prototype.animate === 'function',
	)
	const [entrance, setEntrance] = useState<'opening' | 'moving' | 'complete'>(
		canAnimateEntrance ? 'opening' : 'complete',
	)
	const [isFirstVisit] = useState(() => !hasPersistedDesign())
	const [showIntro, setShowIntro] = useState(isFirstVisit)
	const [mode, setMode] = useState<Mode>('home')
	const [accountOpen, setAccountOpen] = useState(false)
	const [importRequested, setImportRequested] = useState(false)
	const account = useAccount()
	// Following a password-reset link, or landing on an expired one, opens the dialog.
	if ((account.recovering || account.linkError) && !accountOpen) {
		setAccountOpen(true)
	}

	useLayoutEffect(() => {
		if (!canAnimateEntrance) return
		const title = titleRef.current
		if (!title) return

		return () => {
			titleAnimationRef.current?.cancel()
			titleAnimationRef.current = null
			title.style.transformOrigin = ''
		}
	}, [canAnimateEntrance])

	useLayoutEffect(() => {
		// `--base`/`--accent` are set inline below, but CSS custom properties
		// only cascade to descendants, not up to <body>/<html>, so we set
		// their background directly here instead — covering the viewport
		// outside the centered `.page` column and the mobile overscroll
		// area. A literal color (not `var(--base)`) matches index.html's
		// bootstrap script, which sets this same property the same way
		// before React even mounts — one consistent mechanism, rather than
		// an inline style here racing a CSS rule there. useLayoutEffect
		// (not useEffect) runs synchronously before the browser paints, so
		// html/body update in the same frame as `.page` instead of one
		// frame later, which previously caused a visible flash/mismatch
		// when toggling dark mode.
		document.documentElement.style.backgroundColor = base
		document.body.style.backgroundColor = base
	}, [base])

	function handleStarSpinComplete() {
		if (
			!canAnimateEntrance ||
			entranceStartedRef.current ||
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
		) {
			return
		}

		const title = titleRef.current
		if (!title) {
			setEntrance('complete')
			return
		}

		entranceStartedRef.current = true
		if (gate) markEntranceSpinFinished()
		const start = title.getBoundingClientRect()
		releaseOpeningTitle(title)
		const target = title.getBoundingClientRect()
		if (
			start.width === 0 ||
			start.height === 0 ||
			target.width === 0 ||
			target.height === 0
		) {
			setEntrance('complete')
			return
		}

		title.style.transformOrigin = 'top left'

		const transform = `translate(${start.left - target.left}px, ${start.top - target.top}px) scale(${start.width / target.width}, ${start.height / target.height})`
		const animation = title.animate(
			[{ transform }, { transform: 'none' }],
			{
				duration: 1400,
				easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
				fill: 'both',
			},
		)
		titleAnimationRef.current = animation
		animation.onfinish = () => {
			title.style.transformOrigin = ''
			animation.cancel()
			titleAnimationRef.current = null
			setEntrance('complete')
		}
		setEntrance('moving')
	}

	return (
		<div
			className={`${styles.page}${entrance === 'opening' ? ` ${styles.opening}` : ''}`}
			style={
				{
					'--base': base,
					'--accent': accent,
					backgroundColor: base,
				} as CSSProperties
			}
		>
			<Header
				titleRef={titleRef}
				isOpening={entrance === 'opening'}
				isMoving={entrance === 'moving'}
				onStarSpinComplete={handleStarSpinComplete}
				starElapsedMs={handoff?.elapsedMs}
				mode={mode}
				onModeChange={gate ? undefined : setMode}
				onHome={gate ? undefined : () => setMode('home')}
				actions={
					<>
						<AccountControl onOpen={() => setAccountOpen(true)} />
						{!gate && <DarkModeToggle />}
					</>
				}
			/>
			<main className={styles.app}>
				{gate ? (
					<ContentGateView gate={gate} />
				) : (
					<Modes
						mode={mode}
						onModeChange={setMode}
						onSignIn={
							account.status === 'signedOut'
								? () => setAccountOpen(true)
								: undefined
						}
						isFirstVisit={isFirstVisit}
						showIntro={showIntro}
						onIntroComplete={() => setShowIntro(false)}
					/>
				)}
			</main>
			{(gate || mode !== 'zen' || !showIntro) && <Footer />}
			<AccountDialog
				open={accountOpen}
				onClose={() => setAccountOpen(false)}
				actions={
					!gate && (
						<GuestImportButton
							onRequest={() => {
								setAccountOpen(false)
								setImportRequested(true)
							}}
						/>
					)
				}
			/>
			{!gate && (
				<GuestImportDialog
					requested={importRequested}
					suspended={accountOpen}
					onClose={() => setImportRequested(false)}
				/>
			)}
		</div>
	)
}

export default PlayerApp
