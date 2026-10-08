/**
 * A position in the hex grid, using axial coordinates (q, r). The implied
 * cube third coordinate is always `s = -q - r`.
 */
export interface AxialCoord {
	readonly q: number
	readonly r: number
}

/**
 * One hexagon in the kaleidoscope. Every cell belongs to a mirror-symmetry
 * group (`groupId`): painting any cell in a group paints the whole group,
 * reproducing the kaleidoscope's reflective effect. Exactly one cell per
 * group is the `isClickable` representative the user actually interacts
 * with; the rest are its mirrored reflections.
 */
export interface HexCell extends AxialCoord {
	readonly groupId: string
	readonly isClickable: boolean
}
