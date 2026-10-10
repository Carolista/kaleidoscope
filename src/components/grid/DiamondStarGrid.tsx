import { useMemo } from 'react'
import type { Ref } from 'react'
import {
	DIAMOND_STAR_GRID_SIZE,
	generateDiamondStarCells,
} from '@geometry/diamondStarGrid'
import {
	diamondStarBoundingBox,
	diamondStarCellCorners,
} from '@geometry/diamondStarLayout'
import type { DiamondStarLayout } from '@geometry/diamondStarLayout'
import GridView from './GridView'
import type { GridCell } from './GridView'

export interface DiamondStarGridProps {
	readonly gridSize?: number
	// Length of one lattice step within a diamond point, in SVG user
	// units (so `gridSize * diamondSize` is a full spoke's length, center
	// to tip).
	readonly diamondSize?: number
	// Exposes the rendered <svg> element, e.g. for image export.
	readonly svgRef?: Ref<SVGSVGElement>
}

const DEFAULT_DIAMOND_SIZE = 32

function DiamondStarGrid({
	gridSize = DIAMOND_STAR_GRID_SIZE,
	diamondSize = DEFAULT_DIAMOND_SIZE,
	svgRef,
}: DiamondStarGridProps) {
	const layout: DiamondStarLayout = useMemo(
		() => ({ gridSize, size: diamondSize }),
		[gridSize, diamondSize],
	)
	const cells = useMemo(() => generateDiamondStarCells(gridSize), [gridSize])
	const { polygons, viewBox } = useMemo(() => {
		const corners = cells.map(cell => diamondStarCellCorners(cell, layout))
		const { minX, minY, maxX, maxY } = diamondStarBoundingBox(corners)
		const polygons: GridCell[] = cells.map((cell, i) => ({
			kind: 'polygon',
			key: `${cell.row},${cell.col},${cell.transformIndex}`,
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
			label="Kaleidoscope diamond star grid"
			instructions="Tab to move between diamonds. Press Enter or Space to paint the focused diamond with the current color."
		/>
	)
}

export default DiamondStarGrid
