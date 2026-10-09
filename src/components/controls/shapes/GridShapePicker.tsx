import { useState } from 'react'
import { gridShapes } from '@data/gridShapes'
import { isConfirmDialogDismissed } from '@services/confirmDialogPreferences'
import { useAppState } from '@state/useAppState'
import type { GridShapeId } from '@appTypes/gridShape'
import { ConfirmDialog } from '@shared'
import GridShapeIcon from './GridShapeIcon'
import styles from './GridShapePicker.module.css'

const DONT_SHOW_AGAIN_KEY = 'switch-grid-shape'

export interface GridShapePickerProps {
	// Called right after a shape selection takes effect (immediately, if
	// the confirmation has been dismissed, or on confirming the dialog
	// otherwise), so the containing modal can close itself instead of
	// staying open on the now-stale picker.
	readonly onSelected?: () => void
}

// Selecting a different shape than the current one discards the design
// (a group id from one shape's symmetry grouping has no meaning for
// another's), so — like ResetDesignButton — a pick is staged behind a
// confirmation dialog rather than applied immediately.
function GridShapePicker({ onSelected }: GridShapePickerProps) {
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
							aria-label={option.label}
							title={option.label}
							onClick={() => {
								if (option.id === state.gridShape) return
								if (
									isConfirmDialogDismissed(
										DONT_SHOW_AGAIN_KEY,
									)
								) {
									selectGridShape(option.id)
									onSelected?.()
								} else {
									setPending(option.id)
								}
							}}
						>
							<GridShapeIcon shape={option.id} />
						</button>
					</li>
				))}
			</ul>
			<ConfirmDialog
				open={pendingOption !== undefined}
				title="Confirm Shape Change"
				message={`Switching to the ${pendingOption?.label ?? ''} grid will reset your current design. You can undo this afterward if you change your mind.`}
				confirmLabel="Switch"
				cancelLabel="Cancel"
				dontShowAgainKey={DONT_SHOW_AGAIN_KEY}
				onConfirm={() => {
					if (pendingOption) selectGridShape(pendingOption.id)
					setPending(null)
					onSelected?.()
				}}
				onCancel={() => setPending(null)}
			/>
		</>
	)
}

export default GridShapePicker
