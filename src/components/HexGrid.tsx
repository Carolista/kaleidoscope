import { useMemo } from 'react'
import { HEX_GRID_RADIUS, generateHexCells } from '../utils/hexGrid'
import { axialToPixel, boundingBox, hexCorners } from '../utils/hexLayout'
import type { HexLayout } from '../utils/hexLayout'
import Hexagon from './Hexagon'
import styles from './HexGrid.module.css'

export interface HexGridProps {
  readonly radius?: number
  /** Circumradius of each hexagon, in SVG user units. */
  readonly hexSize?: number
  /** Fill color used for every cell. Will become per-cell state in a later step. */
  readonly defaultFill?: string
}

const DEFAULT_HEX_SIZE = 16

/** Renders the kaleidoscope's full hex grid as a single responsive SVG. */
function HexGrid({
  radius = HEX_GRID_RADIUS,
  hexSize = DEFAULT_HEX_SIZE,
  defaultFill = '#222222',
}: HexGridProps) {
  const layout: HexLayout = useMemo(
    () => ({ orientation: 'flat', size: hexSize }),
    [hexSize],
  )

  const cells = useMemo(() => generateHexCells(radius), [radius])

  const { polygons, viewBox } = useMemo(() => {
    const centers = cells.map((cell) => axialToPixel(cell, layout))
    const { minX, minY, maxX, maxY } = boundingBox(centers, layout)
    return {
      polygons: cells.map((cell, i) => ({
        key: `${cell.q},${cell.r}`,
        corners: hexCorners(centers[i], layout),
      })),
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    }
  }, [cells, layout])

  return (
    <svg
      className={styles.hexGrid}
      viewBox={viewBox}
      role="img"
      aria-label="Kaleidoscope hex grid"
    >
      {polygons.map(({ key, corners }) => (
        <Hexagon key={key} corners={corners} fill={defaultFill} />
      ))}
    </svg>
  )
}

export default HexGrid
