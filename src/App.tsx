import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import styles from './App.module.css'
import {
	ColorOptions,
	ColorSchemeButton,
} from '@/components/controls/color-schemes'
import {
	ControlsInfoButton,
	DarkModeToggle,
	EditableAreaToggle,
	RandomizeDesignButton,
	ResetDesignButton,
	SaveImageButton,
	UndoRedoButtons,
} from '@/components/controls'
import { GridShapeButton } from '@/components/controls/shapes'
import { ShapeGrid } from '@/components/grid'
import GridTransition from './components/grid/GridTransition'
import Footer from './components/layout/Footer'
import Header from './components/layout/Header'
import headerStyles from './components/layout/Header.module.css'
import IntroSequence from './components/intro/IntroSequence'
import PuzzleMode from './components/puzzle/PuzzleMode'
import { hasPersistedDesign } from './services/storageService'
import { getThemeColors } from './state/theme'
import { useAppState } from './state/useAppState'

function App() {
	const { state } = useAppState()
	const { base, accent } = getThemeColors(state.darkMode)
	const svgRef = useRef<SVGSVGElement>(null)
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
	const [mode, setMode] = useState<'zen' | 'puzzle'>('zen')

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
		title.classList.remove(headerStyles.openingTitle)
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
			/>
			<main className={styles.app}>
				<PuzzleMode hidden={mode !== 'puzzle'} />
				{mode === 'zen' &&
					(showIntro ? (
						<IntroSequence onContinue={() => setShowIntro(false)} />
					) : (
						<>
							<GridTransition
								gridKey={`${state.gridShape}:${state.gridSizes[state.gridShape]}`}
							>
								<ShapeGrid
									shape={state.gridShape}
									size={state.gridSizes[state.gridShape]}
									svgRef={svgRef}
								/>
							</GridTransition>
							<div
								role="group"
								aria-label="Controls"
								className={styles.controlRows}
							>
								<div className={styles.colorRow}>
									<ColorOptions />
								</div>
								<UndoRedoButtons />
								<div
									role="group"
									aria-label="Settings and Actions"
									className={styles.buttonGroup}
								>
									<div className={styles.buttonRow}>
										<EditableAreaToggle />
										<ColorSchemeButton />
										<RandomizeDesignButton />
										<ResetDesignButton />
									</div>
									<div className={styles.buttonRow}>
										<GridShapeButton />
										<SaveImageButton svgRef={svgRef} />
										<DarkModeToggle />
										<ControlsInfoButton
											initialOpen={isFirstVisit}
										/>
									</div>
								</div>
							</div>
						</>
					))}
			</main>
			{(mode === 'puzzle' || !showIntro) && <Footer />}
		</div>
	)
}

export default App
