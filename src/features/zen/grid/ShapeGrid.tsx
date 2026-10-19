import type { ReactNode, Ref } from 'react'
import type { GridShapeId, GridSize } from '@/domain/shapes'
import { CIRCLE_RINGS_GRID_SIZES } from '@/domain/shapes/circle-rings'
import { DIAMOND_STAR_GRID_SIZES } from '@/domain/shapes/diamond-star'
import { HEXAGON_GRID_RADII } from '@/domain/shapes/hexagon'
import { HEXAGRAM_GRID_SIZES } from '@/domain/shapes/hexagram'
import { PINWHEEL_GRID_SIZES } from '@/domain/shapes/pinwheel'
import { TRIANGLE_GRID_SIZES } from '@/domain/shapes/triangle'
import CircleRingsGrid from './CircleRingsGrid'
import DiamondStarGrid from './DiamondStarGrid'
import HexagonGrid from './HexagonGrid'
import HexagramGrid from './HexagramGrid'
import PinwheelGrid from './PinwheelGrid'
import TriangleGrid from './TriangleGrid'

type SvgRef = Ref<SVGSVGElement> | undefined

const renderers: {
	readonly [Id in GridShapeId]: (size: GridSize, svgRef: SvgRef) => ReactNode
} = {
	hexagon: (size, svgRef) => (
		<HexagonGrid radius={HEXAGON_GRID_RADII[size]} svgRef={svgRef} />
	),
	triangle: (size, svgRef) => (
		<TriangleGrid gridSize={TRIANGLE_GRID_SIZES[size]} svgRef={svgRef} />
	),
	diamondStar: (size, svgRef) => (
		<DiamondStarGrid
			gridSize={DIAMOND_STAR_GRID_SIZES[size]}
			svgRef={svgRef}
		/>
	),
	hexagram: (size, svgRef) => (
		<HexagramGrid gridSize={HEXAGRAM_GRID_SIZES[size]} svgRef={svgRef} />
	),
	circleRings: (size, svgRef) => (
		<CircleRingsGrid
			ringCount={CIRCLE_RINGS_GRID_SIZES[size]}
			svgRef={svgRef}
		/>
	),
	pinwheel: (size, svgRef) => (
		<PinwheelGrid {...PINWHEEL_GRID_SIZES[size]} svgRef={svgRef} />
	),
}

export default function ShapeGrid({
	shape,
	size,
	svgRef,
}: {
	readonly shape: GridShapeId
	readonly size: GridSize
	readonly svgRef?: Ref<SVGSVGElement>
}) {
	return renderers[shape](size, svgRef)
}
