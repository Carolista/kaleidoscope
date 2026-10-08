import type { AxialCoord, HexCell } from '../types/hex'
import { axialToPixel, boundingBox } from './hexLayout'
import type { HexLayout } from './hexLayout'

// Radius 7 (rings out from the center hex) gives `1 + 3*7*8` = 169 cells.
// The original app (and this app through phase 2) used radius 9 (271
// cells, matching the original's hand-authored grid); radius was reduced
// to make the grid more manageable on small touchscreens. See DECISIONS.md.
export const HEX_GRID_RADIUS = 7

interface CubeCoord {
	readonly q: number
	readonly r: number
	readonly s: number
}

function toCube({ q, r }: AxialCoord): CubeCoord {
	return { q, r, s: -q - r }
}

function cubeDistance(c: CubeCoord): number {
	return Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.s))
}

function rotate60(c: CubeCoord): CubeCoord {
	return { q: -c.r, r: -c.s, s: -c.q }
}

function reflect(c: CubeCoord): CubeCoord {
	return { q: c.q, r: c.s, s: c.r }
}

// All images of a coordinate under the kaleidoscope's symmetry group: the
// 6 rotations of the hexagon, each with and without a mirror reflection
// (dihedral group D6, order 12). Duplicate images collapse naturally, so
// orbit size is 12 for a generic cell, 6 for a cell that sits on one of
// the 6 mirror axes, and 1 for the center cell.
function symmetryOrbit(coord: AxialCoord): CubeCoord[] {
	const images = new Map<string, CubeCoord>()
	let current = toCube(coord)
	for (let i = 0; i < 6; i++) {
		for (const candidate of [current, reflect(current)]) {
			images.set(`${candidate.q},${candidate.r}`, candidate)
		}
		current = rotate60(current)
	}
	return [...images.values()]
}

// Deterministic id for a coordinate's symmetry group: the
// lexicographically-smallest (q, r) coordinate in its orbit, rotated one
// more 60-degree step. The un-rotated lexicographic minimum lands the
// clickable wedge at the 9-10 o'clock position; rotating it once moves
// the wedge to 11-12 o'clock, where the controls above the grid are
// positioned, without disturbing the underlying symmetry math. Every cell
// in the same mirror group resolves to the same id.
function groupIdFor(coord: AxialCoord): string {
	const lexMin = symmetryOrbit(coord).reduce((min, c) =>
		c.q < min.q || (c.q === min.q && c.r < min.r) ? c : min,
	)
	const canonical = rotate60(lexMin)
	return `${canonical.q},${canonical.r}`
}

// Generates every hex cell in the kaleidoscope: a filled hexagon of the
// given radius, each cell tagged with its mirror-symmetry group id and
// whether it's the clickable representative for that group (see
// `groupIdFor` — thanks to the symmetry, the representative always lands
// in the same contiguous 30-degree wedge of the grid, just like the
// "editable slice" in the original app).
export function generateHexCells(radius: number = HEX_GRID_RADIUS): HexCell[] {
	const cells: HexCell[] = []
	for (let q = -radius; q <= radius; q++) {
		for (let r = -radius; r <= radius; r++) {
			const cube = toCube({ q, r })
			if (cubeDistance(cube) > radius) continue
			const groupId = groupIdFor({ q, r })
			cells.push({ q, r, groupId, isClickable: groupId === `${q},${r}` })
		}
	}
	return cells
}

// Preserves insertion order (a plain `Map` does), since iteration order of
// the groups matters for the clickable wedge's visual sequence.
export function groupHexCells(
	cells: readonly HexCell[],
): Map<string, HexCell[]> {
	const groups = new Map<string, HexCell[]>()
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

// The grid's overall (width / height) ratio, independent of `hexSize` — a
// uniform scale factor cancels out of the ratio — so this reflects the
// same shape HexGrid renders (and the export service rasterizes from)
// without needing a live DOM/SVG element to measure.
export function computeGridAspectRatio(radius: number = HEX_GRID_RADIUS) {
	const layout: HexLayout = { orientation: 'flat', size: 1 }
	const centers = generateHexCells(radius).map(cell =>
		axialToPixel(cell, layout),
	)
	const { minX, minY, maxX, maxY } = boundingBox(centers, layout)
	return (maxX - minX) / (maxY - minY)
}
