import type { Point } from '../utils/hexLayout'
import { pointsToSvgAttr } from '../utils/hexLayout'
import styles from './Hexagon.module.css'

export interface HexagonProps {
  readonly corners: readonly Point[]
  readonly fill: string
}

/** A single hexagon cell, rendered as an SVG polygon. */
function Hexagon({ corners, fill }: HexagonProps) {
  return (
    <polygon
      className={styles.hexagon}
      points={pointsToSvgAttr(corners)}
      fill={fill}
    />
  )
}

export default Hexagon
