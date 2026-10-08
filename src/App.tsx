import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import HexGrid from './components/HexGrid'
import ColorOptions from './components/ColorOptions'
import SettingsButton from './components/SettingsButton'
import ResetButton from './components/ResetButton'
import SaveImageButton from './components/SaveImageButton'
import UndoRedoButtons from './components/UndoRedoButtons'
import { useAppState } from './state/useAppState'
import { getThemeColors } from './state/theme'
import styles from './App.module.css'

function App() {
	const { state } = useAppState()
	const { base, accent } = getThemeColors(state.darkMode)
	const svgRef = useRef<SVGSVGElement>(null)

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
			<div
				className={styles.topRow}
				role="group"
				aria-label="Color controls"
			>
				<ColorOptions />
				<SettingsButton />
			</div>
			<HexGrid svgRef={svgRef} />
			<div className={styles.bottomRow}>
				<UndoRedoButtons />
				<ResetButton />
				<SaveImageButton svgRef={svgRef} />
			</div>
		</main>
	)
}

export default App
