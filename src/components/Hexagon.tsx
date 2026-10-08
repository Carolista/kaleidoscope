import type { Point } from '../utils/hexLayout'
import { pointsToSvgAttr } from '../utils/hexLayout'
import styles from './Hexagon.module.css'

export interface HexagonProps {
  readonly corners: readonly Point[]
  readonly fill: string
  /** Whether this is the clickable representative of its mirror group. */
  readonly isClickable: boolean
  /** Whether the grid is being hovered and this cell should fade (it's a non-clickable mirror reflection). */
  readonly dimmed: boolean
  readonly onClick?: () => void
}

/**
 * A single hexagon cell, rendered as an SVG polygon. Only the clickable
 * representative of each mirror group responds to clicks; the rest are
 * purely decorative reflections that fade while hovering the grid, to
 * emphasize the single editable "slice".
 */
function Hexagon({
  corners,
  fill,
  isClickable,
  dimmed,
  onClick,
}: HexagonProps) {
  const className = [
    styles.hexagon,
    isClickable && styles.clickable,
    dimmed && styles.dimmed,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <polygon
      className={className}
      points={pointsToSvgAttr(corners)}
      fill={fill}
      onClick={isClickable ? onClick : undefined}
    />
  )
}

export default Hexagon
