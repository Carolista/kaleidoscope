import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import styles from './App.module.css'
import Header from './components/layout/Header'
import DiamondStarGrid from './components/grid/DiamondStarGrid'
import HexagramGrid from './components/grid/HexagramGrid'
import HexagonGrid from './components/grid/HexagonGrid'
import TriangleGrid from './components/grid/TriangleGrid'
import ColorOptions from './components/controls/ColorOptions'
import ColorThemeButton from './components/controls/ColorThemeButton'
import DarkModeToggle from './components/controls/DarkModeToggle'
import EditableAreaToggle from './components/controls/EditableAreaToggle'
import GridShapeButton from './components/controls/GridShapeButton'
import RandomizeDesignButton from './components/controls/RandomizeDesignButton'
import ResetDesignButton from './components/controls/ResetDesignButton'
import SaveImageButton from './components/controls/SaveImageButton'
import TouchIntroModal from './components/controls/TouchIntroModal'
import UndoRedoButtons from './components/controls/UndoRedoButtons'
import { hasPersistedDesign } from './services/storageService'
import { getThemeColors } from './state/theme'
import { useAppState } from './state/useAppState'
import { useIsTouchDevice } from './utils/useIsTouchDevice'

function App() {
	const { state } = useAppState()
	const { base, accent } = getThemeColors(state.darkMode)
	const svgRef = useRef<SVGSVGElement>(null)
	const isTouch = useIsTouchDevice()
	// Captured once, before the autosave effect in AppContext can run, so
	// this reflects whether a design already existed when the app loaded
	// (i.e. this device's first-ever visit) rather than the current state.
	const [hadPersistedDesign] = useState(hasPersistedDesign)
	const [introOpen, setIntroOpen] = useState(
		() => isTouch && !hadPersistedDesign,
	)

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
						<DarkModeToggle />
						<ColorThemeButton />
						<GridShapeButton />
						<RandomizeDesignButton />
						<EditableAreaToggle />
						<ResetDesignButton />
						<SaveImageButton svgRef={svgRef} />
					</div>
				</div>
			</main>
			<TouchIntroModal
				open={introOpen}
				onClose={() => setIntroOpen(false)}
			/>
		</div>
	)
}

export default App
