import { useMemo, useState } from 'react'
import type { Ref } from 'react'
import {
	HEXAGON_GRID_RADIUS,
	generateHexagonCells,
} from '@geometry/hexagonGrid'
import {
	axialToPixel,
	boundingBox,
	hexagonCorners,
} from '@geometry/hexagonLayout'
import type { HexagonLayout } from '@geometry/hexagonLayout'
import { useAppState } from '@state/useAppState'
import { getThemeColors } from '@state/theme'
import { useIsTouchDevice } from '@hooks/useIsTouchDevice'
import PolygonCell from './PolygonCell'
import styles from './HexagonGrid.module.css'

export interface HexagonGridProps {
	readonly radius?: number
	// Circumradius of each hexagon, in SVG user units.
	readonly hexSize?: number
	// Exposes the rendered <svg> element, e.g. for image export.
	readonly svgRef?: Ref<SVGSVGElement>
}

const DEFAULT_HEX_SIZE = 16

function HexagonGrid({
	radius = HEXAGON_GRID_RADIUS,
	hexSize = DEFAULT_HEX_SIZE,
	svgRef,
}: HexagonGridProps) {
	const { state, paintShapeGroup } = useAppState()
	const { base, accent } = getThemeColors(state.darkMode)
	const [isHovering, setIsHovering] = useState(false)
	const isTouch = useIsTouchDevice()
	// Touch devices have no hover, so they get a persistent, user-toggled
	// highlight instead (EditableAreaToggle); mouse/trackpad devices keep
	// relying on hover and ignore showEditableArea entirely.
	const showPersistentHighlight = isTouch && state.showEditableArea

	const layout: HexagonLayout = useMemo(
		() => ({ orientation: 'flat', size: hexSize }),
		[hexSize],
	)

	const cells = useMemo(() => generateHexagonCells(radius), [radius])

	const { polygons, viewBox, tileCount } = useMemo(() => {
		const centers = cells.map(cell => axialToPixel(cell, layout))
		const { minX, minY, maxX, maxY } = boundingBox(centers, layout)
		let clickableIndex = 0
		const polygons = cells.map((cell, i) => ({
			key: `${cell.q},${cell.r}`,
			groupId: cell.groupId,
			isClickable: cell.isClickable,
			tileNumber: cell.isClickable ? ++clickableIndex : undefined,
			corners: hexagonCorners(centers[i], layout),
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
			<p id="hexagon-grid-instructions" className={styles.visuallyHidden}>
				Tab to move between hexagons. Press Enter or Space to paint the
				focused hexagon with the current color.
			</p>
			<svg
				ref={svgRef}
				className={styles.hexagonGrid}
				viewBox={viewBox}
				role="group"
				aria-label="Kaleidoscope hexagon grid"
				aria-describedby="hexagon-grid-instructions"
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

export default HexagonGrid
