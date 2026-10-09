import type { GridShapeOption } from '../types/gridShape'

// Every grid shape offered in the shape picker, in the order they're
// listed. Add a new entry here (plus its cell-generation module and a
// case in gridShapeRegistry.ts) to offer another shape.
export const gridShapes: readonly GridShapeOption[] = [
	{ id: 'hexagon', label: 'Hexagon' },
	{ id: 'triangle', label: 'Triangle' },
	{ id: 'diamondStar', label: 'Diamond Star' },
]
