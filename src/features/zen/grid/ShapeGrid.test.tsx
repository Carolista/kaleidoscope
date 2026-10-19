import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { createRef } from 'react'
import { renderWithProvider } from '@/test/renderWithProvider'
import {
	getGroupIdsForShape,
	gridSizeOptions,
	supportedGridShapes,
} from '@/domain/shapes'
import ShapeGrid from './ShapeGrid'

describe('ShapeGrid', () => {
	it.each(
		supportedGridShapes.flatMap(shape =>
			gridSizeOptions.map(size => [shape.id, size.id] as const),
		),
	)('renders %s at size %s with one tile per group', (shape, size) => {
		renderWithProvider(<ShapeGrid shape={shape} size={size} />)
		expect(screen.getAllByRole('button')).toHaveLength(
			getGroupIdsForShape(shape, size).length,
		)
	})

	it('forwards the SVG ref', () => {
		const svgRef = createRef<SVGSVGElement>()
		renderWithProvider(
			<ShapeGrid shape="hexagon" size="md" svgRef={svgRef} />,
		)
		expect(svgRef.current).toBeInstanceOf(SVGSVGElement)
	})
})
