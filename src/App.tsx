import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef } from 'react'
import styles from './App.module.css'
import { ColorOptions, ColorThemeButton } from '@color-schemes'
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
	TriangleGrid,
} from '@grid'
import Footer from './components/layout/Footer'
import Header from './components/layout/Header'
import { getThemeColors } from './state/theme'
import { useAppState } from './state/useAppState'

function App() {
	const { state } = useAppState()
	const { base, accent } = getThemeColors(state.darkMode)
	const svgRef = useRef<SVGSVGElement>(null)

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
				{state.gridShape === 'triangle' ? (
					<TriangleGrid svgRef={svgRef} />
				) : state.gridShape === 'diamondStar' ? (
					<DiamondStarGrid svgRef={svgRef} />
				) : state.gridShape === 'hexagram' ? (
					<HexagramGrid svgRef={svgRef} />
				) : state.gridShape === 'circleRings' ? (
					<CircleRingsGrid svgRef={svgRef} />
				) : (
					<HexagonGrid svgRef={svgRef} />
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
						<EditableAreaToggle />
						<ColorThemeButton />
						<RandomizeDesignButton />
						<ResetDesignButton />
						<GridShapeButton />
						<SaveImageButton svgRef={svgRef} />
						<DarkModeToggle />
						<ControlsInfoButton />
					</div>
				</div>
			</main>
			<Footer />
		</div>
	)
}

export default App
