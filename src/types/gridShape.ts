// Identifies one of the kaleidoscope's selectable grid shapes. Each shape
// has its own cell-generation/symmetry module (hexagonGrid.ts,
// triangleGrid.ts, ...) but shares the same `shapeGroupColors` paint state,
// since painting/undo/redo only ever need a group id, never shape-specific
// geometry. Every shape but `circleRings` also shares the same rendering
// approach (PolygonCell); `circleRings` renders `<circle>`s (CircleCell)
// instead, since its cells aren't straight-edged.
export type GridShapeId =
	'hexagon' | 'triangle' | 'diamondStar' | 'hexagram' | 'circleRings'

export interface GridShapeOption {
	readonly id: GridShapeId
	readonly label: string
}
