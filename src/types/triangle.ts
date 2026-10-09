// One small triangle in the triangle-grid shape. `row`/`col` locate it
// within the subdivided big triangle (see triangleGrid.ts); `direction`
// distinguishes the two orientations a row's triangles alternate between
// ("up" pointing the same way as the overall big triangle, "down" the
// opposite way). Mirrors HexagonCell's shape-agnostic mirror-symmetry fields.
export interface TriangleCell {
	readonly row: number
	readonly col: number
	readonly direction: 'up' | 'down'
	readonly groupId: string
	readonly isClickable: boolean
}
