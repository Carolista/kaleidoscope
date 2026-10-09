// One small rhombus within the diamond-star shape. `row`/`col` locate it
// within a single diamond point's own lattice: unlike TriangleCell, no
// "direction" is needed — a diamond point is itself a parallelogram, so
// it tiles cleanly into a grid of smaller parallelograms/rhombi, with
// `row` spanning toward one side vertex and `col` toward the other (see
// diamondStarLayout.ts). `transformIndex` records which of the star's 6
// rotational positions (its 6 diamond points) this copy occupies.
export interface DiamondStarCell {
	readonly row: number
	readonly col: number
	readonly transformIndex: number
	readonly groupId: string
	readonly isClickable: boolean
}
