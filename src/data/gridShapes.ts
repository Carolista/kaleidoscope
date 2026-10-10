import type { GridShapeId } from '../types/gridShape'

// Supported shapes remain loadable even when hidden from the picker.
export const supportedGridShapes = [
	{ id: 'hexagon', label: 'Hexagon', pickerVisible: true },
	{ id: 'triangle', label: 'Triangle', pickerVisible: true },
	{ id: 'diamondStar', label: 'Diamond Star', pickerVisible: true },
	{ id: 'hexagram', label: 'Hexagram', pickerVisible: true },
	{ id: 'circleRings', label: 'Circle Rings', pickerVisible: true },
	{ id: 'pinwheel', label: 'Pinwheel', pickerVisible: true },
] as const satisfies readonly {
	readonly id: string
	readonly label: string
	readonly pickerVisible: boolean
}[]

export const gridShapes = supportedGridShapes.filter(
	shape => shape.pickerVisible,
)

export function isGridShapeId(value: unknown): value is GridShapeId {
	return supportedGridShapes.some(shape => shape.id === value)
}
