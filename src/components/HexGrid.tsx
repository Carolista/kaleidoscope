import { useMemo, useState } from 'react'
import { HEX_GRID_RADIUS, generateHexCells } from '../utils/hexGrid'
import { axialToPixel, boundingBox, hexCorners } from '../utils/hexLayout'
import type { HexLayout } from '../utils/hexLayout'
import { useAppState } from '../state/useAppState'
import { getThemeColors } from '../state/theme'
import Hexagon from './Hexagon'
import styles from './HexGrid.module.css'

export interface HexGridProps {
	readonly radius?: number
	// Circumradius of each hexagon, in SVG user units.
	readonly hexSize?: number
}

const DEFAULT_HEX_SIZE = 16

function HexGrid({
	radius = HEX_GRID_RADIUS,
	hexSize = DEFAULT_HEX_SIZE,
}: HexGridProps) {
	const { state, paintHexGroup } = useAppState()
	const { base, accent } = getThemeColors(state.darkMode)
	const [isHovering, setIsHovering] = useState(false)

	const layout: HexLayout = useMemo(
		() => ({ orientation: 'flat', size: hexSize }),
		[hexSize],
	)

	const cells = useMemo(() => generateHexCells(radius), [radius])

	const { polygons, viewBox, tileCount } = useMemo(() => {
		const centers = cells.map(cell => axialToPixel(cell, layout))
		const { minX, minY, maxX, maxY } = boundingBox(centers, layout)
		let clickableIndex = 0
		const polygons = cells.map((cell, i) => ({
			key: `${cell.q},${cell.r}`,
			groupId: cell.groupId,
			isClickable: cell.isClickable,
			tileNumber: cell.isClickable ? ++clickableIndex : undefined,
			corners: hexCorners(centers[i], layout),
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
		setAnnouncement(`Painted hex tile ${tileNumber} of ${tileCount}.`)
	}

	return (
		<>
			<p id="hex-grid-instructions" className={styles.visuallyHidden}>
				Tab to move between hexagons. Press Enter or Space to paint the
				focused hexagon with the current color.
			</p>
			<svg
				className={styles.hexGrid}
				viewBox={viewBox}
				role="group"
				aria-label="Kaleidoscope hex grid"
				aria-describedby="hex-grid-instructions"
				onPointerMove={event =>
					setIsHovering(
						(event.target as Element).tagName === 'polygon',
					)
				}
				onPointerLeave={() => setIsHovering(false)}
			>
				{polygons.map(
					({ key, groupId, isClickable, tileNumber, corners }) => (
						<Hexagon
							key={key}
							corners={corners}
							fill={state.hexGroupColors[groupId] ?? accent}
							isClickable={isClickable}
							dimmed={isHovering && !isClickable}
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

export default HexGrid
