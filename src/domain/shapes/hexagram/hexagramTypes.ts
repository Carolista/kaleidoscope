// One small equilateral triangle in the hexagram-grid shape: a central
// hexagon with an equilateral triangle "point" attached outward on each
// of its 6 edges (a Star-of-David-style outline), with the whole thing
// subdivided into small equilateral triangles. `piece` identifies which
// of the 2 equilateral triangles that make up one 60-degree spoke this
// cell belongs to (`hexSector`, the slice of the central hexagon, or
// `point`, the outward-pointing tip); `row`/`col`/`direction` then
// locate it within that piece's own subdivision, the same way they do
// for TriangleCell. `transformIndex` records which of the shape's 6
// rotational positions (its 6 spokes) this copy occupies.
export interface HexagramCell {
	readonly piece: 'hexSector' | 'point'
	readonly row: number
	readonly col: number
	readonly direction: 'up' | 'down'
	readonly transformIndex: number
	readonly groupId: string
	readonly isClickable: boolean
}
