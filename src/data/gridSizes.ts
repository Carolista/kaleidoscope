import type { GridSize } from '../types/gridSize'
import type { GridShapeId } from '../types/gridShape'

export const gridSizeOptions = [
	{ id: 'sm', label: 'SM' },
	{ id: 'md', label: 'MD' },
	{ id: 'lg', label: 'LG' },
] as const satisfies readonly {
	readonly id: GridSize
	readonly label: string
}[]

export const availableGridSizes: Record<GridShapeId, readonly GridSize[]> = {
	hexagon: ['sm', 'md', 'lg'],
	triangle: ['sm', 'md', 'lg'],
	diamondStar: ['sm', 'md', 'lg'],
	hexagram: ['md'],
	circleRings: ['md'],
	pinwheel: ['md'],
}

export const defaultGridSizes: Record<GridShapeId, GridSize> = {
	hexagon: 'md',
	triangle: 'md',
	diamondStar: 'md',
	hexagram: 'md',
	circleRings: 'md',
	pinwheel: 'md',
}

export const legacyGridSizes: Record<GridShapeId, GridSize> = {
	hexagon: 'lg',
	triangle: 'lg',
	diamondStar: 'md',
	hexagram: 'md',
	circleRings: 'md',
	pinwheel: 'md',
}

export function isGridSize(value: unknown): value is GridSize {
	return gridSizeOptions.some(option => option.id === value)
}
