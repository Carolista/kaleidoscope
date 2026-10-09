import type { CSSProperties, KeyboardEvent } from 'react'
import type { Point } from '../../types/geometry'
import { pointsToSvgAttr } from '../../utils/svgPoints'
import { getHoverFill } from '../../utils/colorMath'
import styles from './PolygonCell.module.css'

// A single clickable (or purely decorative/mirrored) cell in any
// polygon-based grid shape — hexagon, triangle, or future shapes built
// from straight-edged cells. Operates only on raw corner points, so it
// has no idea what shape it's rendering.
export interface PolygonCellProps {
	readonly corners: readonly Point[]
	readonly fill: string
	// Clickable representative of its mirror group; the rest are purely
	// decorative reflections.
	readonly isClickable: boolean
	// True while the grid is hovered and this cell should fade.
	readonly dimmed: boolean
	readonly base: string
	readonly accent: string
	// 1-based position among clickable tiles, for the accessible name.
	// Only meaningful when isClickable.
	readonly tileNumber?: number
	readonly tileCount?: number
	readonly onClick?: () => void
}

function PolygonCell({
	corners,
	fill,
	isClickable,
	dimmed,
	base,
	accent,
	tileNumber,
	tileCount,
	onClick,
}: PolygonCellProps) {
	const className = [
		styles.cell,
		isClickable && styles.clickable,
		dimmed && styles.dimmed,
	]
		.filter(Boolean)
		.join(' ')

	const hoverFill = isClickable ? getHoverFill(fill, base, accent) : fill

	function handleKeyDown(event: KeyboardEvent<SVGPolygonElement>) {
		if (event.key === 'Enter' || event.key === ' ') {
			// Prevent the page from scrolling on Space, matching native button behavior.
			event.preventDefault()
			onClick?.()
		}
	}

	return (
		<polygon
			className={className}
			points={pointsToSvgAttr(corners)}
			fill={fill}
			style={{ '--hover-fill': hoverFill } as CSSProperties}
			onClick={isClickable ? onClick : undefined}
			onKeyDown={isClickable ? handleKeyDown : undefined}
			tabIndex={isClickable ? 0 : undefined}
			role={isClickable ? 'button' : undefined}
			aria-label={
				isClickable
					? `Paint tile ${tileNumber} of ${tileCount}`
					: undefined
			}
			aria-hidden={isClickable ? undefined : true}
		/>
	)
}

export default PolygonCell
