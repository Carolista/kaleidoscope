// Identifies one of the kaleidoscope's selectable grid shapes. Each shape
// has its own cell-generation/symmetry module (hexagonGrid.ts,
// triangleGrid.ts, ...) but shares the same `shapeGroupColors` paint state
// and rendering approach (PolygonCell), since painting/undo/redo only ever
// need a group id, never shape-specific geometry.
export type GridShapeId = 'hexagon' | 'triangle' | 'diamondStar' | 'hexagram'

export interface GridShapeOption {
	readonly id: GridShapeId
	readonly label: string
}
