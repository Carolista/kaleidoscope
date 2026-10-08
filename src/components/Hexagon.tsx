import type { CSSProperties } from 'react'
import type { Point } from '../utils/hexLayout'
import { pointsToSvgAttr } from '../utils/hexLayout'
import { getHoverFill } from '../utils/colorMath'
import styles from './Hexagon.module.css'

export interface HexagonProps {
  readonly corners: readonly Point[]
  readonly fill: string
  /** Whether this is the clickable representative of its mirror group. */
  readonly isClickable: boolean
  /** Whether the grid is being hovered and this cell should fade (it's a non-clickable mirror reflection). */
  readonly dimmed: boolean
  /** Current theme colors, used to compute a sensible hover highlight for this cell's fill. */
  readonly base: string
  readonly accent: string
  readonly onClick?: () => void
}

/**
 * A single hexagon cell, rendered as an SVG polygon. Only the clickable
 * representative of each mirror group responds to clicks and hover
 * feedback; the rest are purely decorative reflections that fade while
 * hovering the grid, to emphasize the single editable "slice".
 */
function Hexagon({
  corners,
  fill,
  isClickable,
  dimmed,
  base,
  accent,
  onClick,
}: HexagonProps) {
  const className = [
    styles.hexagon,
    isClickable && styles.clickable,
    dimmed && styles.dimmed,
  ]
    .filter(Boolean)
    .join(' ')

  const hoverFill = isClickable ? getHoverFill(fill, base, accent) : fill

  return (
    <polygon
      className={className}
      points={pointsToSvgAttr(corners)}
      fill={fill}
      style={{ '--hover-fill': hoverFill } as CSSProperties}
      onClick={isClickable ? onClick : undefined}
    />
  )
}

export default Hexagon
