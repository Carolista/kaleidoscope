import { useMemo } from 'react'
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
import GridView from './GridView'
import type { GridCell } from './GridView'

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
	const layout: HexagonLayout = useMemo(
		() => ({ orientation: 'flat', size: hexSize }),
		[hexSize],
	)
	const cells = useMemo(() => generateHexagonCells(radius), [radius])
	const { polygons, viewBox } = useMemo(() => {
		const centers = cells.map(cell => axialToPixel(cell, layout))
		const { minX, minY, maxX, maxY } = boundingBox(centers, layout)
		const polygons: GridCell[] = cells.map((cell, i) => ({
			kind: 'polygon',
			key: `${cell.q},${cell.r}`,
			groupId: cell.groupId,
			isClickable: cell.isClickable,
			corners: hexagonCorners(centers[i], layout),
		}))
		return {
			polygons,
			viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
		}
	}, [cells, layout])

	return (
		<GridView
			cells={polygons}
			viewBox={viewBox}
			svgRef={svgRef}
			sizingAspectRatio={0.8763}
			label="Kaleidoscope hexagon grid"
			instructions="Tab to move between hexagons. Press Enter or Space to paint the focused hexagon with the current color."
		/>
	)
}

export default HexagonGrid
