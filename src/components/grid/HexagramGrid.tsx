import { useMemo, useState } from 'react'
import type { Ref } from 'react'
import {
	HEXAGRAM_GRID_SIZE,
	generateHexagramCells,
} from '@geometry/hexagramGrid'
import {
	hexagramBoundingBox,
	hexagramStarCellCorners,
} from '@geometry/hexagramLayout'
import type { HexagramLayout } from '@geometry/hexagramLayout'
import { useAppState } from '@state/useAppState'
import { getThemeColors } from '@state/theme'
import { useIsTouchDevice } from '@hooks/useIsTouchDevice'
import PolygonCell from './PolygonCell'
import styles from './HexagramGrid.module.css'

export interface HexagramGridProps {
	readonly gridSize?: number
	// Edge length of each small triangle, in SVG user units.
	readonly triangleSize?: number
	// Exposes the rendered <svg> element, e.g. for image export.
	readonly svgRef?: Ref<SVGSVGElement>
}

const DEFAULT_TRIANGLE_SIZE = 32

// The hexagram counterpart of HexagonGrid/TriangleGrid/DiamondStarGrid: same
// rendering/interaction approach (PolygonCell, hover/touch dimming,
// keyboard support, live region announcements), but built from the
// central-hexagon-plus-6-points subdivision in hexagramGrid.ts. Still
// reuses the shared `shapeGroupColors` state/`paintShapeGroup` action,
// since both are already shape-agnostic in practice (just a map keyed by
// group id).
function HexagramGrid({
	gridSize = HEXAGRAM_GRID_SIZE,
	triangleSize = DEFAULT_TRIANGLE_SIZE,
	svgRef,
}: HexagramGridProps) {
	const { state, paintShapeGroup } = useAppState()
	const { base, accent } = getThemeColors(state.darkMode)
	const [isHovering, setIsHovering] = useState(false)
	const isTouch = useIsTouchDevice()
	const showPersistentHighlight = isTouch && state.showEditableArea

	const layout: HexagramLayout = useMemo(
		() => ({ gridSize, size: triangleSize }),
		[gridSize, triangleSize],
	)

	const cells = useMemo(() => generateHexagramCells(gridSize), [gridSize])

	const { polygons, viewBox, tileCount } = useMemo(() => {
		const corners = cells.map(cell => hexagramStarCellCorners(cell, layout))
		const { minX, minY, maxX, maxY } = hexagramBoundingBox(corners)
		let clickableIndex = 0
		const polygons = cells.map((cell, i) => ({
			key: `${cell.piece},${cell.row},${cell.col},${cell.direction},${cell.transformIndex}`,
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
				id="hexagram-grid-instructions"
				className={styles.visuallyHidden}
			>
				Tab to move between triangles. Press Enter or Space to paint the
				focused triangle with the current color.
			</p>
			<svg
				ref={svgRef}
				className={styles.hexagramGrid}
				viewBox={viewBox}
				role="group"
				aria-label="Kaleidoscope hexagram grid"
				aria-describedby="hexagram-grid-instructions"
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

export default HexagramGrid
