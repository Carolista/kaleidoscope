import { useEffect } from 'react'
import { useAppState } from '../state/useAppState'
import styles from './UndoRedoButtons.module.css'

function UndoRedoButtons() {
	const { undo, redo, canUndo, canRedo } = useAppState()

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			const isModifierPressed = event.metaKey || event.ctrlKey
			if (!isModifierPressed || event.key.toLowerCase() !== 'z') return

			event.preventDefault()
			if (event.shiftKey) {
				redo()
			} else {
				undo()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [undo, redo])

	return (
		<div className={styles.group}>
			<button
				type="button"
				className={styles.button}
				aria-label="Undo"
				title="Undo (Ctrl/Cmd+Z)"
				disabled={!canUndo}
				onClick={undo}
			>
				<i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				className={styles.button}
				aria-label="Redo"
				title="Redo (Ctrl/Cmd+Shift+Z)"
				disabled={!canRedo}
				onClick={redo}
			>
				<i className="fa-solid fa-rotate-right" aria-hidden="true"></i>
			</button>
		</div>
	)
}

export default UndoRedoButtons
