import type { CSSProperties } from 'react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { getThemeColors } from '@/domain/palettes'
import {
	AccountDialog,
	GuestImportDialog,
	useAccount,
} from '@/features/account'
import { HomeScreen } from '@/features/home'
import { PuzzleMode } from '@/features/puzzle'
import { hasPersistedDesign, ZenMode } from '@/features/zen'
import type { ContentGate } from '@/ui/content'
import { ContentGateView, usePuzzleResume } from '@/ui/content'
import { TextCaseContext } from '@/ui/text'
import { usePlayerTheme } from '@/ui/theme'
import {
	markEntranceSpinFinished,
	markEntranceStarted,
	readEntranceHandoff,
	TITLE_MOVE_MS,
} from './entranceHandoff'
import {
	Footer,
	Header,
	ModeDialog,
	releaseOpeningTitle,
	restoreOpeningTitle,
	type Mode,
} from './layout'
import { SettingsControl, SettingsDialog } from './settings'
import usePageBackground from './usePageBackground'
import styles from './PlayerApp.module.css'

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
	const [openPalette, setOpenPalette] = useState(false)
	// Only the visit that a palette reward sent the player on opens the picker.
	if (mode !== 'zen' && openPalette) setOpenPalette(false)
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
				onOpenZen={intent => {
					if (intent === 'palette') setOpenPalette(true)
					onModeChange('zen')
				}}
				returningGuest={account.returningGuest}
				onCreateAccount={onSignIn}
				openRequest={openRequest}
			/>
			{mode === 'zen' && (
				<ZenMode
					isFirstVisit={isFirstVisit}
					showIntro={showIntro}
					onIntroComplete={onIntroComplete}
					openPalette={openPalette}
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
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [modesOpen, setModesOpen] = useState(false)
	const [importRequested, setImportRequested] = useState(false)
	const account = useAccount()
	// Following a password-reset link, or landing on an expired one, opens the dialog.
	if ((account.recovering || account.linkError) && !accountOpen) {
		setAccountOpen(true)
	}

	usePageBackground(base)

	const handleStarSpinComplete = useCallback(() => {
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
				duration: TITLE_MOVE_MS,
				delay: -(handoff?.moveElapsedMs ?? 0),
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
	}, [canAnimateEntrance, gate, handoff])

	useLayoutEffect(() => {
		if (!canAnimateEntrance) return
		const title = titleRef.current
		if (!title) return

		// A frame rebuilt while the title was on its way to the header picks the move up
		// where it was, rather than waiting for a spin that has already ended.
		const resumeMove = !!handoff?.spinDone
		if (resumeMove) handleStarSpinComplete()

		return () => {
			titleAnimationRef.current?.cancel()
			titleAnimationRef.current = null
			title.style.transformOrigin = ''
			if (resumeMove) {
				entranceStartedRef.current = false
				restoreOpeningTitle(title)
			}
		}
	}, [canAnimateEntrance, handoff, handleStarSpinComplete])

	return (
		<TextCaseContext.Provider value="title">
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
					onOpenModes={gate ? undefined : () => setModesOpen(true)}
					onHome={gate ? undefined : () => setMode('home')}
					actions={
						<SettingsControl onOpen={() => setSettingsOpen(true)} />
					}
				/>
				<main
					className={`${styles.app}${handoff?.settled ? ` ${styles.arriving}` : ''}`}
				>
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
				{!gate && (
					<ModeDialog
						open={modesOpen}
						mode={mode}
						onSelect={setMode}
						onClose={() => setModesOpen(false)}
					/>
				)}
				<SettingsDialog
					open={settingsOpen}
					onClose={() => setSettingsOpen(false)}
					onSignIn={
						account.status === 'unavailable'
							? undefined
							: () => {
									setSettingsOpen(false)
									setAccountOpen(true)
								}
					}
					onImportProgress={
						gate
							? undefined
							: () => {
									setSettingsOpen(false)
									setImportRequested(true)
								}
					}
					showGameSettings={!gate}
				/>
				<AccountDialog
					open={accountOpen}
					onClose={() => setAccountOpen(false)}
				/>
				{!gate && (
					<GuestImportDialog
						requested={importRequested}
						suspended={accountOpen || settingsOpen}
						onClose={() => setImportRequested(false)}
					/>
				)}
			</div>
		</TextCaseContext.Provider>
	)
}

export default PlayerApp
