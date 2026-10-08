import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import styles from './App.module.css'
import ColorOptions from './components/ColorOptions'
import ColorThemeButton from './components/ColorThemeButton'
import DarkModeToggle from './components/DarkModeToggle'
import EditableAreaToggle from './components/EditableAreaToggle'
import HexGrid from './components/HexGrid'
import ResetButton from './components/ResetButton'
import SaveImageButton from './components/SaveImageButton'
import TouchIntroModal from './components/TouchIntroModal'
import UndoRedoButtons from './components/UndoRedoButtons'
import { hasPersistedDesign } from './state/persistence'
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

	useEffect(() => {
		// `--base`/`--accent` are set inline below, but CSS custom properties
		// only cascade to descendants, not up to <body>/<html>. Set the page
		// background directly so the whole viewport follows the theme, not
		// just the centered app column.
		document.body.style.backgroundColor = base
	}, [base])

	return (
		<main
			className={styles.app}
			style={{ '--base': base, '--accent': accent } as CSSProperties}
		>
			<h1 className={styles.title}>Kaleidoscope</h1>
			<HexGrid svgRef={svgRef} />
			<div className={styles.buttonRows}>
				<UndoRedoButtons />
				<div className={styles.colorRow}>
					<ColorOptions />
				</div>
				<div
					role="group"
					aria-label="Settings"
					className={styles.buttonGroup}
				>
					<DarkModeToggle />
					<ColorThemeButton />
					<EditableAreaToggle />
					<ResetButton />
					<SaveImageButton svgRef={svgRef} />
				</div>
			</div>
			<TouchIntroModal
				open={introOpen}
				onClose={() => setIntroOpen(false)}
			/>
		</main>
	)
}

export default App
