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
import Footer from './components/layout/Footer'
import Header from './components/layout/Header'
import IntroSequence from './components/intro/IntroSequence'
import { hasPersistedDesign } from './services/storageService'
import { getThemeColors } from './state/theme'
import { useAppState } from './state/useAppState'
import type { GridShapeId } from './types/gridShape'
import { HEXAGON_GRID_RADII } from '@geometry/hexagonGrid'
import { TRIANGLE_GRID_SIZES } from '@geometry/triangleGrid'

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
	const Grid = gridComponents[state.gridShape]
	const [isFirstVisit] = useState(() => !hasPersistedDesign())
	const [showIntro, setShowIntro] = useState(isFirstVisit)

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

	return (
		<div
			className={styles.page}
			style={
				{
					'--base': base,
					'--accent': accent,
					backgroundColor: base,
				} as CSSProperties
			}
		>
			<Header />
			<main className={styles.app}>
				{showIntro ? (
					<IntroSequence onContinue={() => setShowIntro(false)} />
				) : (
					<>
						{state.gridShape === 'triangle' ? (
							<TriangleGrid
								gridSize={
									TRIANGLE_GRID_SIZES[
										state.gridSizes.triangle
									]
								}
								svgRef={svgRef}
							/>
						) : state.gridShape === 'hexagon' ? (
							<HexagonGrid
								radius={
									HEXAGON_GRID_RADII[state.gridSizes.hexagon]
								}
								svgRef={svgRef}
							/>
						) : (
							<Grid svgRef={svgRef} />
						)}
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
