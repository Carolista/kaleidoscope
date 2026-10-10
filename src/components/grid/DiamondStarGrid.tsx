import { useMemo, useState } from 'react'
import type { Ref } from 'react'
import {
	DIAMOND_STAR_GRID_SIZE,
	generateDiamondStarCells,
} from '@geometry/diamondStarGrid'
import {
	diamondStarBoundingBox,
	diamondStarCellCorners,
} from '@geometry/diamondStarLayout'
import type { DiamondStarLayout } from '@geometry/diamondStarLayout'
import { useAppState } from '@state/useAppState'
import { getThemeColors } from '@state/theme'
import { useIsTouchDevice } from '@hooks/useIsTouchDevice'
import PolygonCell from './PolygonCell'
import styles from './DiamondStarGrid.module.css'

export interface DiamondStarGridProps {
	readonly gridSize?: number
	// Length of one lattice step within a diamond point, in SVG user
	// units (so `gridSize * diamondSize` is a full spoke's length, center
	// to tip).
	readonly diamondSize?: number
	// Exposes the rendered <svg> element, e.g. for image export.
	readonly svgRef?: Ref<SVGSVGElement>
}

const DEFAULT_DIAMOND_SIZE = 32

// The diamond-star counterpart of HexagonGrid/TriangleGrid: same rendering/
// interaction approach (PolygonCell, hover/touch dimming, keyboard
// support, live region announcements), but built from the 6-point
// elongated-diamond-star subdivision in diamondStarGrid.ts. Still reuses
// the shared `shapeGroupColors` state/`paintShapeGroup` action, since both
// are already shape-agnostic in practice (just a map keyed by group id).
function DiamondStarGrid({
	gridSize = DIAMOND_STAR_GRID_SIZE,
	diamondSize = DEFAULT_DIAMOND_SIZE,
	svgRef,
}: DiamondStarGridProps) {
	const { state, paintShapeGroup } = useAppState()
	const { base, accent } = getThemeColors(state.darkMode)
	const [isHovering, setIsHovering] = useState(false)
	const isTouch = useIsTouchDevice()
	const showPersistentHighlight = isTouch && state.showEditableArea

	const layout: DiamondStarLayout = useMemo(
		() => ({ gridSize, size: diamondSize }),
		[gridSize, diamondSize],
	)

	const cells = useMemo(() => generateDiamondStarCells(gridSize), [gridSize])

	const { polygons, viewBox, tileCount } = useMemo(() => {
		const corners = cells.map(cell => diamondStarCellCorners(cell, layout))
		const { minX, minY, maxX, maxY } = diamondStarBoundingBox(corners)
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
				id="diamond-star-grid-instructions"
				className={styles.visuallyHidden}
			>
				Tab to move between diamonds. Press Enter or Space to paint the
				focused diamond with the current color.
			</p>
			<svg
				ref={svgRef}
				className={styles.diamondStarGrid}
				viewBox={viewBox}
				role="group"
				aria-label="Kaleidoscope diamond star grid"
				aria-describedby="diamond-star-grid-instructions"
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

export default DiamondStarGrid
