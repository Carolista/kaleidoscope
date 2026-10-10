import { useMemo, useState } from 'react'
import type { Ref } from 'react'
import {
	PINWHEEL_COL_STEPS,
	PINWHEEL_ROW_STEPS,
	generatePinwheelCells,
} from '@utils/pinwheelGrid'
import { pinwheelBoundingBox, pinwheelCellCorners } from '@utils/pinwheelLayout'
import type { PinwheelLayout } from '@utils/pinwheelLayout'
import { useAppState } from '@state/useAppState'
import { getThemeColors } from '@state/theme'
import { useIsTouchDevice } from '@utils/useIsTouchDevice'
import PolygonCell from './PolygonCell'
import styles from './PinwheelGrid.module.css'

export interface PinwheelGridProps {
	readonly rowSteps?: number
	readonly colSteps?: number
	// Reference lattice-step length, in SVG user units (see
	// PinwheelLayout.size).
	readonly spokeSize?: number
	// Exposes the rendered <svg> element, e.g. for image export.
	readonly svgRef?: Ref<SVGSVGElement>
}

const DEFAULT_SPOKE_SIZE = 30

// The pinwheel counterpart of HexagonGrid/DiamondStarGrid: same
// rendering/interaction approach (PolygonCell, hover/touch dimming,
// keyboard support, live region announcements), but built from the
// 8-spoke, rotation-only (no mirror) subdivision in pinwheelGrid.ts.
// Still reuses the shared `shapeGroupColors` state/`paintShapeGroup`
// action, since both are already shape-agnostic in practice (just a map
// keyed by group id).
function PinwheelGrid({
	rowSteps = PINWHEEL_ROW_STEPS,
	colSteps = PINWHEEL_COL_STEPS,
	spokeSize = DEFAULT_SPOKE_SIZE,
	svgRef,
}: PinwheelGridProps) {
	const { state, paintShapeGroup } = useAppState()
	const { base, accent } = getThemeColors(state.darkMode)
	const [isHovering, setIsHovering] = useState(false)
	const isTouch = useIsTouchDevice()
	const showPersistentHighlight = isTouch && state.showEditableArea

	const layout: PinwheelLayout = useMemo(
		() => ({ rowSteps, colSteps, size: spokeSize }),
		[rowSteps, colSteps, spokeSize],
	)

	const cells = useMemo(
		() => generatePinwheelCells(rowSteps, colSteps),
		[rowSteps, colSteps],
	)

	const { polygons, viewBox, tileCount } = useMemo(() => {
		const corners = cells.map(cell => pinwheelCellCorners(cell, layout))
		const { minX, minY, maxX, maxY } = pinwheelBoundingBox(corners)
		let clickableIndex = 0
		const polygons = cells.map((cell, i) => ({
			key: `${cell.row},${cell.col},${cell.transformIndex}`,
			groupId: cell.groupId,
			isClickable: cell.isClickable,
			tileNumber: cell.isClickable ? ++clickableIndex : undefined,
			corners: corners[i],
		}))
		return {
			polygons,
			viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
			tileCount: clickableIndex,
		}
	}, [cells, layout])

	const [announcement, setAnnouncement] = useState('')

	function handlePaint(groupId: string, tileNumber: number | undefined) {
		paintShapeGroup(groupId)
		setAnnouncement(`Painted tile ${tileNumber} of ${tileCount}.`)
	}

	return (
		<>
			<p
				id="pinwheel-grid-instructions"
				className={styles.visuallyHidden}
			>
				Tab to move between pieces. Press Enter or Space to paint the
				focused piece with the current color.
			</p>
			<svg
				ref={svgRef}
				className={styles.pinwheelGrid}
				viewBox={viewBox}
				role="group"
				aria-label="Kaleidoscope pinwheel grid"
				aria-describedby="pinwheel-grid-instructions"
				onPointerMove={event =>
					setIsHovering(
						(event.target as Element).tagName === 'polygon',
					)
				}
				onPointerLeave={() => setIsHovering(false)}
			>
				{polygons.map(
					({ key, groupId, isClickable, tileNumber, corners }) => (
						<PolygonCell
							key={key}
							corners={corners}
							fill={state.shapeGroupColors[groupId] ?? accent}
							isClickable={isClickable}
							dimmed={
								(isHovering || showPersistentHighlight) &&
								!isClickable
							}
							base={base}
							accent={accent}
							tileNumber={tileNumber}
							tileCount={tileCount}
							onClick={() => handlePaint(groupId, tileNumber)}
						/>
					),
				)}
			</svg>
			<p
				role="status"
				aria-live="polite"
				className={styles.visuallyHidden}
			>
				{announcement}
			</p>
		</>
	)
}

export default PinwheelGrid
