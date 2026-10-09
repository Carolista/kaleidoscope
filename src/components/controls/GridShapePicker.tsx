import { useState } from 'react'
import { gridShapes } from '../../data/gridShapes'
import { useAppState } from '../../state/useAppState'
import type { GridShapeId } from '../../types/gridShape'
import ConfirmDialog from '../shared/ConfirmDialog'
import styles from './GridShapePicker.module.css'

// Selecting a different shape than the current one discards the design
// (a group id from one shape's symmetry grouping has no meaning for
// another's), so — like ResetDesignButton — a pick is staged behind a
// confirmation dialog rather than applied immediately.
function GridShapePicker() {
	const { state, selectGridShape } = useAppState()
	const [pending, setPending] = useState<GridShapeId | null>(null)
	const pendingOption = gridShapes.find(option => option.id === pending)

	return (
		<>
			<ul className={styles.list}>
				{gridShapes.map(option => (
					<li key={option.id}>
						<button
							type="button"
							className={styles.shapeButton}
							aria-pressed={state.gridShape === option.id}
							onClick={() => {
								if (option.id !== state.gridShape) {
									setPending(option.id)
								}
							}}
						>
							{option.label}
						</button>
					</li>
				))}
			</ul>
			<ConfirmDialog
				open={pendingOption !== undefined}
				title="Switch grid shape?"
				message={`Switching to the ${pendingOption?.label ?? ''} grid will reset your current design. You can undo this afterward if you change your mind.`}
				confirmLabel="Switch"
				cancelLabel="Cancel"
				onConfirm={() => {
					if (pendingOption) selectGridShape(pendingOption.id)
					setPending(null)
				}}
				onCancel={() => setPending(null)}
			/>
		</>
	)
}

export default GridShapePicker
