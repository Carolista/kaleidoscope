// A plain 2D coordinate, shared by every shape's layout/geometry math
// (hexagon, triangle, and future shapes) and by the generic symmetry engine
// (symmetry.ts) that operates on arbitrary points.
export interface Point {
	readonly x: number
	readonly y: number
}
