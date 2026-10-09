import type { CSSProperties, KeyboardEvent } from 'react'
import type { Point } from '@appTypes/geometry'
import { getHoverFill } from '@utils/colorMath'
import styles from './CircleCell.module.css'

// The circle-rings counterpart of PolygonCell: a single clickable (or
// purely decorative/mirrored) circle. Operates only on a raw center
// point and radius, mirroring PolygonCell's "no idea what shape it's
// rendering" approach, just for a `<circle>` instead of a `<polygon>`.
export interface CircleCellProps {
	readonly center: Point
	readonly radius: number
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

function CircleCell({
	center,
	radius,
	fill,
	isClickable,
	dimmed,
	base,
	accent,
	tileNumber,
	tileCount,
	onClick,
}: CircleCellProps) {
	const className = [
		styles.cell,
		isClickable && styles.clickable,
		dimmed && styles.dimmed,
	]
		.filter(Boolean)
		.join(' ')

	const hoverFill = isClickable ? getHoverFill(fill, base, accent) : fill

	function handleKeyDown(event: KeyboardEvent<SVGCircleElement>) {
		if (event.key === 'Enter' || event.key === ' ') {
			// Prevent the page from scrolling on Space, matching native button behavior.
			event.preventDefault()
			onClick?.()
		}
	}

	return (
		<circle
			className={className}
			cx={center.x}
			cy={center.y}
			r={radius}
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

export default CircleCell
