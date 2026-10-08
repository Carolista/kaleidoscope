import type { CSSProperties, KeyboardEvent } from 'react'
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
  /** 1-based position among clickable tiles, used to build an accessible name. Only meaningful when isClickable. */
  readonly tileNumber?: number
  readonly tileCount?: number
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
  tileNumber,
  tileCount,
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
        isClickable ? `Paint hex tile ${tileNumber} of ${tileCount}` : undefined
      }
      aria-hidden={isClickable ? undefined : true}
    />
  )
}

export default Hexagon
