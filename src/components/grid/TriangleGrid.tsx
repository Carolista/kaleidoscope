import { useMemo } from 'react'
import type { Ref } from 'react'
import {
	TRIANGLE_GRID_SIZE,
	generateTriangleCells,
} from '@geometry/triangleGrid'
import { triangleCorners, trianglesBoundingBox } from '@geometry/triangleLayout'
import type { TriangleLayout } from '@geometry/triangleLayout'
import GridView from './GridView'
import type { GridCell } from './GridView'

export interface TriangleGridProps {
	readonly gridSize?: number
	// Edge length of each small triangle, in SVG user units.
	readonly triangleSize?: number
	// Exposes the rendered <svg> element, e.g. for image export.
	readonly svgRef?: Ref<SVGSVGElement>
}

const DEFAULT_TRIANGLE_SIZE = 32

function TriangleGrid({
	gridSize = TRIANGLE_GRID_SIZE,
	triangleSize = DEFAULT_TRIANGLE_SIZE,
	svgRef,
}: TriangleGridProps) {
	const layout: TriangleLayout = useMemo(
		() => ({ size: triangleSize }),
		[triangleSize],
	)
	const cells = useMemo(() => generateTriangleCells(gridSize), [gridSize])
	const { polygons, viewBox } = useMemo(() => {
		const corners = cells.map(cell => triangleCorners(cell, layout))
		const { minX, minY, maxX, maxY } = trianglesBoundingBox(corners)
		const polygons: GridCell[] = cells.map((cell, i) => ({
			kind: 'polygon',
			key: `${cell.row},${cell.col},${cell.direction}`,
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
			sizingAspectRatio={1.1547}
			label="Kaleidoscope triangle grid"
			instructions="Tab to move between triangles. Press Enter or Space to paint the focused triangle with the current color."
		/>
	)
}

export default TriangleGrid
