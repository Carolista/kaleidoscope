import type { ComponentType, CSSProperties, Ref } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import styles from './App.module.css'
import { ColorOptions, ColorSchemeButton } from '@color-schemes'
import {
	ControlsInfoButton,
	DarkModeToggle,
	EditableAreaToggle,
	RandomizeDesignButton,
	ResetDesignButton,
	SaveImageButton,
	UndoRedoButtons,
} from '@controls'
import { GridShapeButton } from '@shapes'
import {
	CircleRingsGrid,
	DiamondStarGrid,
	HexagonGrid,
	HexagramGrid,
	PinwheelGrid,
	TriangleGrid,
} from '@grid'
import GridTransition from './components/grid/GridTransition'
import Footer from './components/layout/Footer'
import Header from './components/layout/Header'
import headerStyles from './components/layout/Header.module.css'
import IntroSequence from './components/intro/IntroSequence'
import { hasPersistedDesign } from './services/storageService'
import { getThemeColors } from './state/theme'
import { useAppState } from './state/useAppState'
import type { GridShapeId } from './types/gridShape'
import { HEXAGON_GRID_RADII } from '@geometry/hexagonGrid'
import { TRIANGLE_GRID_SIZES } from '@geometry/triangleGrid'
import { DIAMOND_STAR_GRID_SIZES } from '@geometry/diamondStarGrid'
import { HEXAGRAM_GRID_SIZES } from '@geometry/hexagramGrid'
import { CIRCLE_RINGS_GRID_SIZES } from '@geometry/circleRingsGrid'
import { PINWHEEL_GRID_SIZES } from '@geometry/pinwheelGrid'

const gridComponents = {
	hexagon: HexagonGrid,
	triangle: TriangleGrid,
	diamondStar: DiamondStarGrid,
	hexagram: HexagramGrid,
	circleRings: CircleRingsGrid,
	pinwheel: PinwheelGrid,
} satisfies Record<
	GridShapeId,
	ComponentType<{ readonly svgRef?: Ref<SVGSVGElement> }>
>

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
	const Grid = gridComponents[state.gridShape]
	const [isFirstVisit] = useState(() => !hasPersistedDesign())
	const [showIntro, setShowIntro] = useState(isFirstVisit)

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
			/>
			<main className={styles.app}>
				{showIntro ? (
					<IntroSequence onContinue={() => setShowIntro(false)} />
				) : (
					<>
						<GridTransition
							gridKey={`${state.gridShape}:${state.gridSizes[state.gridShape]}`}
						>
							{state.gridShape === 'triangle' ? (
								<TriangleGrid
									gridSize={
										TRIANGLE_GRID_SIZES[
											state.gridSizes.triangle
										]
									}
									svgRef={svgRef}
								/>
							) : state.gridShape === 'diamondStar' ? (
								<DiamondStarGrid
									gridSize={
										DIAMOND_STAR_GRID_SIZES[
											state.gridSizes.diamondStar
										]
									}
									svgRef={svgRef}
								/>
							) : state.gridShape === 'hexagram' ? (
								<HexagramGrid
									gridSize={
										HEXAGRAM_GRID_SIZES[
											state.gridSizes.hexagram
										]
									}
									svgRef={svgRef}
								/>
							) : state.gridShape === 'hexagon' ? (
								<HexagonGrid
									radius={
										HEXAGON_GRID_RADII[
											state.gridSizes.hexagon
										]
									}
									svgRef={svgRef}
								/>
							) : state.gridShape === 'circleRings' ? (
								<CircleRingsGrid
									ringCount={
										CIRCLE_RINGS_GRID_SIZES[
											state.gridSizes.circleRings
										]
									}
									svgRef={svgRef}
								/>
							) : state.gridShape === 'pinwheel' ? (
								<PinwheelGrid
									{...PINWHEEL_GRID_SIZES[
										state.gridSizes.pinwheel
									]}
									svgRef={svgRef}
								/>
							) : (
								<Grid svgRef={svgRef} />
							)}
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
				)}
			</main>
			{!showIntro && <Footer />}
		</div>
	)
}

export default App
