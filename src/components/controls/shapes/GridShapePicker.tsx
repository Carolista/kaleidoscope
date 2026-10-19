import { gridShapes } from '@/data/gridShapes'
import { availableGridSizes, gridSizeOptions } from '@/data/gridSizes'
import { useAppState } from '@/state/useAppState'
import type { GridShapeId } from '@/types/gridShape'
import type { GridSize } from '@/types/gridSize'
import GridShapeIcon from './GridShapeIcon'
import styles from './GridShapePicker.module.css'

export interface GridShapePickerProps {
	// Called after a shape or size selection takes effect, so the containing
	// modal can close instead of staying open on the now-stale picker.
	readonly onSelected?: () => void
}

function GridShapePicker({ onSelected }: GridShapePickerProps) {
	const { state, selectGridShape, selectGridSize } = useAppState()

	function chooseSize(shape: GridShapeId, size: GridSize) {
		if (shape === state.gridShape) {
			if (state.gridSizes[shape] === size) return
			selectGridSize(shape, size)
			onSelected?.()
			return
		}
		selectGridShape(shape, size)
		onSelected?.()
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
		</>
	)
}

export default GridShapePicker
