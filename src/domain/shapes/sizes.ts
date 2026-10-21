import type { GridShapeId } from './catalog'

export type GridSize = 'sm' | 'md' | 'lg'

export const gridSizeOptions = [
	{ id: 'sm', label: 'S' },
	{ id: 'md', label: 'M' },
	{ id: 'lg', label: 'L' },
] as const satisfies readonly {
	readonly id: GridSize
	readonly label: string
}[]

export const availableGridSizes: Record<GridShapeId, readonly GridSize[]> = {
	hexagon: ['sm', 'md', 'lg'],
	triangle: ['sm', 'md', 'lg'],
	diamondStar: ['sm', 'md', 'lg'],
	hexagram: ['sm', 'md', 'lg'],
	circleRings: ['sm', 'md', 'lg'],
	pinwheel: ['sm', 'md', 'lg'],
}

export const defaultGridSizes: Record<GridShapeId, GridSize> = {
	hexagon: 'md',
	triangle: 'md',
	diamondStar: 'md',
	hexagram: 'lg',
	circleRings: 'lg',
	pinwheel: 'lg',
}

export const legacyGridSizes: Record<GridShapeId, GridSize> = {
	hexagon: 'lg',
	triangle: 'lg',
	diamondStar: 'md',
	hexagram: 'lg',
	circleRings: 'lg',
	pinwheel: 'lg',
}

export function isGridSize(value: unknown): value is GridSize {
	return gridSizeOptions.some(option => option.id === value)
}
