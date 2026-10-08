import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import styles from './App.module.css'
import Header from './components/layout/Header'
import HexGrid from './components/grid/HexGrid'
import ColorOptions from './components/controls/ColorOptions'
import ColorThemeButton from './components/controls/ColorThemeButton'
import DarkModeToggle from './components/controls/DarkModeToggle'
import EditableAreaToggle from './components/controls/EditableAreaToggle'
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

	useEffect(() => {
		// `--base`/`--accent` are set inline below, but CSS custom properties
		// only cascade to descendants, not up to <body>/<html>. Set the page
		// background directly so the whole viewport follows the theme, not
		// just the centered app column.
		document.body.style.backgroundColor = base
	}, [base])

	return (
		<div
			className={styles.page}
			style={{ '--base': base, '--accent': accent } as CSSProperties}
		>
			<Header />
			<main className={styles.app}>
				<HexGrid svgRef={svgRef} />
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
