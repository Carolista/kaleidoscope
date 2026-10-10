import { createRef } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProvider } from '@test/renderWithProvider'
import CircleRingsGrid from './CircleRingsGrid'
import DiamondStarGrid from './DiamondStarGrid'
import HexagonGrid from './HexagonGrid'
import HexagramGrid from './HexagramGrid'
import PinwheelGrid from './PinwheelGrid'
import TriangleGrid from './TriangleGrid'

const grids = [
	{
		name: 'hexagon',
		component: HexagonGrid,
		cells: 169,
		tiles: 20,
		ratio: 0.8763,
	},
	{
		name: 'triangle',
		component: TriangleGrid,
		cells: 100,
		tiles: 22,
		ratio: 1.1547,
	},
	{
		name: 'diamond star',
		component: DiamondStarGrid,
		cells: 96,
		tiles: 10,
		ratio: 0.866,
	},
	{
		name: 'hexagram',
		component: HexagramGrid,
		cells: 192,
		tiles: 20,
		ratio: 0.866,
	},
	{
		name: 'pinwheel',
		component: PinwheelGrid,
		cells: 72,
		tiles: 9,
		ratio: 1,
	},
	{
		name: 'circle rings',
		component: CircleRingsGrid,
		cells: 127,
		tiles: 16,
		ratio: 1,
	},
]

beforeEach(() => {
	localStorage.clear()
})

describe('Grid adapters', () => {
	it.each(grids)(
		'preserves $name cell counts, labels, export ref, and sizing ratio',
		({ name, component: Grid, cells, tiles, ratio }) => {
			const svgRef = createRef<SVGSVGElement>()
			renderWithProvider(<Grid svgRef={svgRef} />)
			const svg = screen.getByRole('group', {
				name: `Kaleidoscope ${name} grid`,
			})
			expect(svgRef.current).toBe(svg)
			expect(svg.querySelectorAll('polygon, circle')).toHaveLength(cells)
			expect(screen.getAllByRole('button')).toHaveLength(tiles)
			expect(svg.style.getPropertyValue('--grid-aspect-ratio')).toBe(
				String(ratio),
			)
			expect(svg).toHaveAccessibleDescription(/Tab to move between/)
		},
	)
})
