// One small parallelogram within the pinwheel shape. `row` counts lattice
// steps toward the spoke's `sideRight` vertex, `col` toward its `sideLeft`
// vertex — the same scheme as DiamondStarCell — but unlike the diamond
// star, the pinwheel deliberately uses a *different* step count per axis
// (`rowSteps` vs `colSteps` in PinwheelLayout), so the lattice itself
// isn't mirror-symmetric even though the spoke's outline is: that
// asymmetry is what gives the shape its "twisted" look once 8 copies are
// rotated (never mirrored) around the center. `transformIndex` records
// which of the pinwheel's 8 rotational positions this copy occupies.
export interface PinwheelCell {
	readonly row: number
	readonly col: number
	readonly transformIndex: number
	readonly groupId: string
	readonly isClickable: boolean
}
