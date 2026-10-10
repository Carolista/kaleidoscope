import type { Point } from '../types/geometry'
import type { PinwheelCell } from '../types/pinwheel'
import { assignSymmetryGroups } from '@utils/symmetry'
import {
	FULL_ANGLE_DEGREES,
	PINWHEEL_FOLD,
	PINWHEEL_ROTATIONS,
	pinwheelBoundingBox,
	spokeCellCorners,
} from './pinwheelLayout'
import type { PinwheelLayout } from './pinwheelLayout'

// Number of lattice steps from the center to each spoke's `sideRight`/
// `sideLeft` vertices (see pinwheelLayout.ts). Each step is a uniform
// elongated cell (`size` wide along the row axis, `size *
// PINWHEEL_COL_ASPECT_RATIO` long along the col axis) rather than a
// square, which — combined with `sideRight`/`sideLeft` being
// deliberately unequal distances from the center — is what keeps the
// spoke from reading as a sharp, symmetric star point. `PINWHEEL_ROW_STEPS
// * PINWHEEL_COL_STEPS` clickable groups per spoke (9 at these
// defaults).
export const PINWHEEL_ROW_STEPS = 3
export const PINWHEEL_COL_STEPS = 3

const CENTER: Point = { x: 0, y: 0 }

// A fixed, abstract layout (step length 1) used only to compute each
// small parallelogram's centroid for the symmetry math below —
// unrelated to the actual on-screen render size, which PinwheelGrid.tsx
// supplies.
function unitLayout(rowSteps: number, colSteps: number): PinwheelLayout {
	return { rowSteps, colSteps, size: 1 }
}

interface RawCell {
	readonly row: number
	readonly col: number
}

// Every small parallelogram within one spoke, in row-major order.
function generateSpokeCells(rowSteps: number, colSteps: number): RawCell[] {
	const cells: RawCell[] = []
	for (let row = 0; row < rowSteps; row++) {
		for (let col = 0; col < colSteps; col++) {
			cells.push({ row, col })
		}
	}
	return cells
}

function centroid(corners: readonly Point[]): Point {
	const sum = corners.reduce(
		(acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
		{ x: 0, y: 0 },
	)
	return { x: sum.x / corners.length, y: sum.y / corners.length }
}

// Picks the canonical (clickable) member of each symmetry orbit: the
// cells belonging to spoke 0 (the "up" spoke), spanning exactly
// `FULL_ANGLE_DEGREES` centered on straight up (270 degrees) — matching
// every other shape's convention of identifying the clickable wedge by
// angle via the shared `assignSymmetryGroups` engine, rather than simply
// checking `transformIndex === 0` directly. Since rotation-only orbits
// here always have exactly one member per 45-degree slice (no mirror
// pairing to create degenerate on-axis cases), a closed range reliably
// picks exactly one representative per orbit.
function isCanonicalWedge(point: Point): boolean {
	let angle =
		Math.atan2(point.y - CENTER.y, point.x - CENTER.x) * (180 / Math.PI)
	if (angle < 0) angle += 360
	const start = 270 - FULL_ANGLE_DEGREES / 2
	const end = 270 + FULL_ANGLE_DEGREES / 2
	return angle >= start && angle <= end
}

// Generates every small parallelogram in the kaleidoscope's pinwheel
// shape: one spoke (see pinwheelLayout.ts) subdivided into a
// `rowSteps x colSteps` lattice, replicated across the pinwheel's 8
// rotational positions with no mirroring (a C8, not D8, symmetry group) —
// each spoke's own lopsided lattice can't be its own mirror image, so
// unlike every other shape here, painting one cell never implies
// painting a mirrored partner, only its 7 rotated copies.
export function generatePinwheelCells(
	rowSteps: number = PINWHEEL_ROW_STEPS,
	colSteps: number = PINWHEEL_COL_STEPS,
): PinwheelCell[] {
	const layout = unitLayout(rowSteps, colSteps)
	const baseCells = generateSpokeCells(rowSteps, colSteps)
	const baseCorners = baseCells.map(cell => spokeCellCorners(cell, layout))

	const raw: {
		row: number
		col: number
		transformIndex: number
		centroid: Point
	}[] = []
	PINWHEEL_ROTATIONS.forEach((transform, transformIndex) => {
		baseCells.forEach((cell, cellIndex) => {
			const corners = baseCorners[cellIndex].map(transform)
			raw.push({ ...cell, transformIndex, centroid: centroid(corners) })
		})
	})

	const assignments = assignSymmetryGroups(
		raw.map(cell => cell.centroid),
		{ center: CENTER, fold: PINWHEEL_FOLD, mirror: false },
		isCanonicalWedge,
	)

	return raw.map((cell, index) => ({
		row: cell.row,
		col: cell.col,
		transformIndex: cell.transformIndex,
		groupId: assignments[index].groupId,
		isClickable: assignments[index].isClickable,
	}))
}

// Preserves insertion order (a plain `Map` does), since iteration order of
// the groups matters for the clickable wedge's visual sequence.
export function groupPinwheelCells(
	cells: readonly PinwheelCell[],
): Map<string, PinwheelCell[]> {
	const groups = new Map<string, PinwheelCell[]>()
	for (const cell of cells) {
		const list = groups.get(cell.groupId)
		if (list) {
			list.push(cell)
		} else {
			groups.set(cell.groupId, [cell])
		}
	}
	return groups
}

// Every distinct symmetry group id in the grid — lets callers (e.g. the
// design randomizer) know which groups exist without needing the full
// cell list.
export function getGroupIds(
	rowSteps: number = PINWHEEL_ROW_STEPS,
	colSteps: number = PINWHEEL_COL_STEPS,
): string[] {
	return [
		...groupPinwheelCells(generatePinwheelCells(rowSteps, colSteps)).keys(),
	]
}

// The grid's overall (width / height) ratio, independent of render size
// — a uniform scale factor cancels out of the ratio — so this reflects
// the same shape PinwheelGrid renders (and the export service
// rasterizes from) without needing a live DOM/SVG element to measure.
export function computeGridAspectRatio(
	rowSteps: number = PINWHEEL_ROW_STEPS,
	colSteps: number = PINWHEEL_COL_STEPS,
): number {
	const layout = unitLayout(rowSteps, colSteps)
	const baseCells = generateSpokeCells(rowSteps, colSteps)
	const baseCorners = baseCells.map(cell => spokeCellCorners(cell, layout))
	const corners = PINWHEEL_ROTATIONS.flatMap(transform =>
		baseCorners.map(cellCorners => cellCorners.map(transform)),
	)
	const { minX, minY, maxX, maxY } = pinwheelBoundingBox(corners)
	return (maxX - minX) / (maxY - minY)
}
