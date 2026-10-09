import { useMemo, useState } from 'react'
import type { Ref } from 'react'
import {
	TRIANGLE_GRID_SIZE,
	generateTriangleCells,
} from '../../utils/triangleGrid'
import {
	triangleCorners,
	trianglesBoundingBox,
} from '../../utils/triangleLayout'
import type { TriangleLayout } from '../../utils/triangleLayout'
import { useAppState } from '../../state/useAppState'
import { getThemeColors } from '../../state/theme'
import { useIsTouchDevice } from '../../utils/useIsTouchDevice'
import PolygonCell from './PolygonCell'
import styles from './TriangleGrid.module.css'

export interface TriangleGridProps {
	readonly gridSize?: number
	// Edge length of each small triangle, in SVG user units.
	readonly triangleSize?: number
	// Exposes the rendered <svg> element, e.g. for image export.
	readonly svgRef?: Ref<SVGSVGElement>
}

const DEFAULT_TRIANGLE_SIZE = 32

// The triangle-grid counterpart of HexGrid: same rendering/interaction
// approach (PolygonCell, hover/touch dimming, keyboard support, live
// region announcements), but built from the equilateral-triangle
// subdivision in triangleGrid.ts instead of hex cells. Still reuses the
// hex-named `hexGroupColors` state/`paintHexGroup` action, since both are
// already shape-agnostic in practice (just a map keyed by group id).
function TriangleGrid({
	gridSize = TRIANGLE_GRID_SIZE,
	triangleSize = DEFAULT_TRIANGLE_SIZE,
	svgRef,
}: TriangleGridProps) {
	const { state, paintHexGroup } = useAppState()
	const { base, accent } = getThemeColors(state.darkMode)
	const [isHovering, setIsHovering] = useState(false)
	const isTouch = useIsTouchDevice()
	const showPersistentHighlight = isTouch && state.showEditableArea

	const layout: TriangleLayout = useMemo(
		() => ({ size: triangleSize }),
		[triangleSize],
	)

	const cells = useMemo(() => generateTriangleCells(gridSize), [gridSize])

	const { polygons, viewBox, tileCount } = useMemo(() => {
		const corners = cells.map(cell => triangleCorners(cell, layout))
		const { minX, minY, maxX, maxY } = trianglesBoundingBox(corners)
		let clickableIndex = 0
		const polygons = cells.map((cell, i) => ({
			key: `${cell.row},${cell.col},${cell.direction}`,
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
		paintHexGroup(groupId)
		setAnnouncement(`Painted tile ${tileNumber} of ${tileCount}.`)
	}

	return (
		<>
			<p
				id="triangle-grid-instructions"
				className={styles.visuallyHidden}
			>
				Tab to move between triangles. Press Enter or Space to paint the
				focused triangle with the current color.
			</p>
			<svg
				ref={svgRef}
				className={styles.triangleGrid}
				viewBox={viewBox}
				role="group"
				aria-label="Kaleidoscope triangle grid"
				aria-describedby="triangle-grid-instructions"
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
							fill={state.hexGroupColors[groupId] ?? accent}
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

export default TriangleGrid
