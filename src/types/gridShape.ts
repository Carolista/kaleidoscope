// Identifies one of the kaleidoscope's selectable grid shapes. Each shape
// has its own cell-generation/symmetry module (hexagonGrid.ts,
// triangleGrid.ts, ...) but shares the same `shapeGroupColors` paint state,
// since painting/undo/redo only ever need a group id, never shape-specific
// geometry. Every shape but `circleRings` also shares the same rendering
// approach (PolygonCell); `circleRings` renders `<circle>`s (CircleCell)
// instead, since its cells aren't straight-edged. Every shape but
// `pinwheel` uses mirror symmetry (D_n) to replicate/group its cells;
// `pinwheel` is rotation-only (C8), since its own lopsided lattice can't
// be its own mirror image.
export type GridShapeId =
	| 'hexagon'
	| 'triangle'
	| 'diamondStar'
	| 'hexagram'
	| 'circleRings'
	| 'pinwheel'

export interface GridShapeOption {
	readonly id: GridShapeId
	readonly label: string
}
