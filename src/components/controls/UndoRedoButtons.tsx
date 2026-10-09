import { useEffect } from 'react'
import { useAppState } from '@state/useAppState'
import { IconButton } from '@shared'
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
			<IconButton
				icon="rotate-left"
				label="Undo"
				title="Undo (Ctrl/Cmd+Z)"
				size="sm"
				disabled={!canUndo}
				onClick={undo}
			/>
			<IconButton
				icon="rotate-right"
				label="Redo"
				title="Redo (Ctrl/Cmd+Shift+Z)"
				size="sm"
				disabled={!canRedo}
				onClick={redo}
			/>
		</div>
	)
}

export default UndoRedoButtons
