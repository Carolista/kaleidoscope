import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { getThemeColors } from '@/domain/palettes'
import { AccountControl, AccountDialog } from '@/features/account'
import { PuzzleMode } from '@/features/puzzle'
import { hasPersistedDesign, ZenMode } from '@/features/zen'
import { DarkModeToggle } from '@/ui/components'
import { usePlayerTheme } from '@/ui/theme'
import { Footer, Header, releaseOpeningTitle } from './layout'
import styles from './PlayerApp.module.css'

function PlayerApp() {
	const { darkMode } = usePlayerTheme()
	const { base, accent } = getThemeColors(darkMode)
	const titleRef = useRef<HTMLHeadingElement>(null)
	const titleAnimationRef = useRef<Animation | null>(null)
	const entranceStartedRef = useRef(false)
	const [canAnimateEntrance] = useState(
		() =>
			!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
			typeof Element.prototype.animate === 'function',
	)
	const [entrance, setEntrance] = useState<'opening' | 'moving' | 'complete'>(
		canAnimateEntrance ? 'opening' : 'complete',
	)
	const [isFirstVisit] = useState(() => !hasPersistedDesign())
	const [showIntro, setShowIntro] = useState(isFirstVisit)
	const [mode, setMode] = useState<'zen' | 'puzzle'>('puzzle')
	const [accountOpen, setAccountOpen] = useState(false)

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
				mode={mode}
				onModeChange={setMode}
				actions={
					<>
						<AccountControl onOpen={() => setAccountOpen(true)} />
						<DarkModeToggle />
					</>
				}
			/>
			<main className={styles.app}>
				<PuzzleMode
					hidden={mode !== 'puzzle'}
					onOpenZen={() => setMode('zen')}
				/>
				{mode === 'zen' && (
					<ZenMode
						isFirstVisit={isFirstVisit}
						showIntro={showIntro}
						onIntroComplete={() => setShowIntro(false)}
					/>
				)}
			</main>
			{(mode === 'puzzle' || !showIntro) && <Footer />}
			<AccountDialog
				open={accountOpen}
				onClose={() => setAccountOpen(false)}
			/>
		</div>
	)
}

export default PlayerApp
