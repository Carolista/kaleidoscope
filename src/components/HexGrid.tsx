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
  /** Circumradius of each hexagon, in SVG user units. */
  readonly hexSize?: number
}

const DEFAULT_HEX_SIZE = 16

/** Renders the kaleidoscope's full hex grid as a single responsive SVG. */
function HexGrid({
  radius = HEX_GRID_RADIUS,
  hexSize = DEFAULT_HEX_SIZE,
}: HexGridProps) {
  const { state, paintHexGroup } = useAppState()
  const { accent } = getThemeColors(state.darkMode)
  const [isHovering, setIsHovering] = useState(false)

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
        groupId: cell.groupId,
        isClickable: cell.isClickable,
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
      onPointerMove={(event) =>
        setIsHovering((event.target as Element).tagName === 'polygon')
      }
      onPointerLeave={() => setIsHovering(false)}
    >
      {polygons.map(({ key, groupId, isClickable, corners }) => (
        <Hexagon
          key={key}
          corners={corners}
          fill={state.hexGroupColors[groupId] ?? accent}
          isClickable={isClickable}
          dimmed={isHovering && !isClickable}
          onClick={() => paintHexGroup(groupId)}
        />
      ))}
    </svg>
  )
}

export default HexGrid
