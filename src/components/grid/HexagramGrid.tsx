import { useMemo } from 'react'
import type { Ref } from 'react'
import {
	HEXAGRAM_GRID_SIZE,
	generateHexagramCells,
} from '@geometry/hexagramGrid'
import {
	hexagramBoundingBox,
	hexagramStarCellCorners,
} from '@geometry/hexagramLayout'
import type { HexagramLayout } from '@geometry/hexagramLayout'
import GridView from './GridView'
import type { GridCell } from './GridView'

export interface HexagramGridProps {
	readonly gridSize?: number
	// Edge length of each small triangle, in SVG user units.
	readonly triangleSize?: number
	// Exposes the rendered <svg> element, e.g. for image export.
	readonly svgRef?: Ref<SVGSVGElement>
}

const DEFAULT_TRIANGLE_SIZE = 32

function HexagramGrid({
	gridSize = HEXAGRAM_GRID_SIZE,
	triangleSize = DEFAULT_TRIANGLE_SIZE,
	svgRef,
}: HexagramGridProps) {
	const layout: HexagramLayout = useMemo(
		() => ({ gridSize, size: triangleSize }),
		[gridSize, triangleSize],
	)
	const cells = useMemo(() => generateHexagramCells(gridSize), [gridSize])
	const { polygons, viewBox } = useMemo(() => {
		const corners = cells.map(cell => hexagramStarCellCorners(cell, layout))
		const { minX, minY, maxX, maxY } = hexagramBoundingBox(corners)
		const polygons: GridCell[] = cells.map((cell, i) => ({
			kind: 'polygon',
			key: `${cell.piece},${cell.row},${cell.col},${cell.direction},${cell.transformIndex}`,
			groupId: cell.groupId,
			isClickable: cell.isClickable,
			corners: corners[i],
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
			sizingAspectRatio={0.866}
			label="Kaleidoscope hexagram grid"
			instructions="Tab to move between triangles. Press Enter or Space to paint the focused triangle with the current color."
		/>
	)
}

export default HexagramGrid
