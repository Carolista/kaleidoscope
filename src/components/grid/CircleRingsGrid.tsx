import { useMemo } from 'react'
import type { Ref } from 'react'
import {
	CIRCLE_RINGS_GRID_SIZE,
	generateCircleRingsCells,
} from '@geometry/circleRingsGrid'
import {
	circleRingsBoundingBox,
	circleRingsCellCenter,
	circleRingsCellRadius,
} from '@geometry/circleRingsLayout'
import type { CircleRingsLayout } from '@geometry/circleRingsLayout'
import GridView from './GridView'
import type { GridCell } from './GridView'

export interface CircleRingsGridProps {
	readonly ringCount?: number
	// Diameter of the center dot/ring 1's circles, in SVG user units.
	readonly ringSize?: number
	// Exposes the rendered <svg> element, e.g. for image export.
	readonly svgRef?: Ref<SVGSVGElement>
}

const DEFAULT_RING_SIZE = 30

function CircleRingsGrid({
	ringCount = CIRCLE_RINGS_GRID_SIZE,
	ringSize = DEFAULT_RING_SIZE,
	svgRef,
}: CircleRingsGridProps) {
	const layout: CircleRingsLayout = useMemo(
		() => ({ ringCount, size: ringSize }),
		[ringCount, ringSize],
	)
	const cells = useMemo(
		() => generateCircleRingsCells(ringCount),
		[ringCount],
	)
	const { circles, viewBox } = useMemo(() => {
		const positioned = cells.map(cell => ({
			center: circleRingsCellCenter(cell, layout),
			radius: circleRingsCellRadius(cell, layout),
		}))
		const { minX, minY, maxX, maxY } = circleRingsBoundingBox(positioned)
		const circles: GridCell[] = cells.map((cell, i) => ({
			kind: 'circle',
			key: `${cell.ring},${cell.index}`,
			groupId: cell.groupId,
			isClickable: cell.isClickable,
			...positioned[i],
		}))
		return {
			circles,
			viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
		}
	}, [cells, layout])

	return (
		<GridView
			cells={circles}
			viewBox={viewBox}
			svgRef={svgRef}
			sizingAspectRatio={1}
			label="Kaleidoscope circle rings grid"
			instructions="Tab to move between circles. Press Enter or Space to paint the focused circle with the current color."
		/>
	)
}

export default CircleRingsGrid
