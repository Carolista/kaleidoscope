import { useState } from 'react'
import { gridShapes } from '@data/gridShapes'
import { availableGridSizes, gridSizeOptions } from '@data/gridSizes'
import { isConfirmDialogDismissed } from '@services/confirmDialogPreferences'
import { useAppState } from '@state/useAppState'
import type { GridShapeId } from '@appTypes/gridShape'
import type { GridSize } from '@appTypes/gridSize'
import { ConfirmDialog } from '@shared'
import GridShapeIcon from './GridShapeIcon'
import styles from './GridShapePicker.module.css'

const DONT_SHOW_AGAIN_KEY = 'switch-grid-shape'

export interface GridShapePickerProps {
	// Called after a shape or size selection takes effect, so the containing
	// modal can close instead of staying open on the now-stale picker.
	readonly onSelected?: () => void
}

// Selecting a different shape than the current one discards the design
// (a group id from one shape's symmetry grouping has no meaning for
// another's), so — like ResetDesignButton — a pick is staged behind a
// confirmation dialog rather than applied immediately.
function GridShapePicker({ onSelected }: GridShapePickerProps) {
	const { state, selectGridShape, selectGridSize } = useAppState()
	const [pending, setPending] = useState<{
		readonly shape: GridShapeId
		readonly size: GridSize
	} | null>(null)
	const pendingOption = gridShapes.find(
		option => option.id === pending?.shape,
	)

	function chooseSize(shape: GridShapeId, size: GridSize) {
		if (shape === state.gridShape) {
			if (state.gridSizes[shape] === size) return
			selectGridSize(shape, size)
			onSelected?.()
			return
		}
		if (isConfirmDialogDismissed(DONT_SHOW_AGAIN_KEY)) {
			selectGridShape(shape, size)
			onSelected?.()
		} else {
			setPending({ shape, size })
		}
	}

	return (
		<>
			<ul className={styles.list}>
				{gridShapes.map(option => (
					<li key={option.id} className={styles.row}>
						<div
							className={styles.sizes}
							role="group"
							aria-label={`${option.label} grid size`}
						>
							{gridSizeOptions.map(size => {
								const available = availableGridSizes[
									option.id
								].includes(size.id)
								return (
									<button
										key={size.id}
										type="button"
										className={styles.sizeButton}
										data-size={size.id}
										aria-label={`${option.label} (${size.label})`}
										aria-pressed={
											state.gridShape === option.id &&
											state.gridSizes[option.id] ===
												size.id
										}
										title={`${option.label} (${size.label})`}
										disabled={!available}
										onClick={() =>
											chooseSize(option.id, size.id)
										}
									>
										<GridShapeIcon shape={option.id} />
									</button>
								)
							})}
						</div>
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
					if (pendingOption && pending) {
						selectGridShape(pending.shape, pending.size)
					}
					setPending(null)
					onSelected?.()
				}}
				onCancel={() => setPending(null)}
			/>
		</>
	)
}

export default GridShapePicker
