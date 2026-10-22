// Supported shapes remain loadable even when hidden from the picker.
// Listed in unlock order: every shape menu and list follows this order, so
// keep it in sync with the `shape_progression` table.
export const supportedGridShapes = [
	{ id: 'hexagon', label: 'Hexagon', pickerVisible: true },
	{ id: 'triangle', label: 'Triangle', pickerVisible: true },
	{ id: 'diamondStar', label: 'Diamond Star', pickerVisible: true },
	{ id: 'hexagram', label: 'Hexagram', pickerVisible: true },
	{ id: 'pinwheel', label: 'Pinwheel', pickerVisible: true },
	{ id: 'circleRings', label: 'Circle Rings', pickerVisible: true },
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

// Identifies one of the kaleidoscope's supported grid shapes. Each shape
// has its own cell-generation/symmetry module (hexagonGrid.ts,
// triangleGrid.ts, ...) but shares the same `shapeGroupColors` paint state,
// since painting/undo/redo only ever need a group id, never shape-specific
// geometry. Every shape but `circleRings` also shares the same rendering
// approach (PolygonCell); `circleRings` renders `<circle>`s (CircleCell)
// instead, since its cells aren't straight-edged. Every shape but
// `pinwheel` uses mirror symmetry (D_n) to replicate/group its cells;
// `pinwheel` is rotation-only (C8), since its own lopsided lattice can't
// be its own mirror image.
export type GridShapeId = (typeof supportedGridShapes)[number]['id']

export interface GridShapeOption {
	readonly id: GridShapeId
	readonly label: string
}
