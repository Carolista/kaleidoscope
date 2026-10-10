import { useMemo } from 'react'
import type { Ref } from 'react'
import {
	PINWHEEL_COL_STEPS,
	PINWHEEL_ROW_STEPS,
	generatePinwheelCells,
} from '@geometry/pinwheelGrid'
import {
	pinwheelBoundingBox,
	pinwheelCellCorners,
} from '@geometry/pinwheelLayout'
import type { PinwheelLayout } from '@geometry/pinwheelLayout'
import GridView from './GridView'
import type { GridCell } from './GridView'

export interface PinwheelGridProps {
	readonly rowSteps?: number
	readonly colSteps?: number
	// Reference lattice-step length, in SVG user units (see
	// PinwheelLayout.size).
	readonly spokeSize?: number
	// Exposes the rendered <svg> element, e.g. for image export.
	readonly svgRef?: Ref<SVGSVGElement>
}

const DEFAULT_SPOKE_SIZE = 30

function PinwheelGrid({
	rowSteps = PINWHEEL_ROW_STEPS,
	colSteps = PINWHEEL_COL_STEPS,
	spokeSize = DEFAULT_SPOKE_SIZE,
	svgRef,
}: PinwheelGridProps) {
	const layout: PinwheelLayout = useMemo(
		() => ({ rowSteps, colSteps, size: spokeSize }),
		[rowSteps, colSteps, spokeSize],
	)
	const cells = useMemo(
		() => generatePinwheelCells(rowSteps, colSteps),
		[rowSteps, colSteps],
	)
	const { polygons, viewBox } = useMemo(() => {
		const corners = cells.map(cell => pinwheelCellCorners(cell, layout))
		const { minX, minY, maxX, maxY } = pinwheelBoundingBox(corners)
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
			sizingAspectRatio={1}
			label="Kaleidoscope pinwheel grid"
			instructions="Tab to move between pieces. Press Enter or Space to paint the focused piece with the current color."
		/>
	)
}

export default PinwheelGrid
