import type { PuzzleShapeId } from '@/domain/puzzles'

// SVG units per tile: a hexagon's circumradius, a triangle's side (also used
// by hexagram), a diamond-star or pinwheel lattice step, or an inner ring's
// circle diameter.
export const tileSizes: Readonly<Record<PuzzleShapeId, number>> = {
	hexagon: 16,
	triangle: 28,
	diamondStar: 48,
	hexagram: 28,
	circleRings: 30,
	pinwheel: 22,
}
