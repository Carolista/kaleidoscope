import type { Point } from '../types/geometry'

// A generic SVG helper, shared by every shape's rendering code (and the
// shape-picker's preview icons) — formats a cell's corner points as the
// `points` attribute of an SVG `<polygon>`. Lived in hexLayout.ts back
// when hexagon was the only shape; moved out once that file was renamed to
// hexagonLayout.ts, since this has nothing to do with hexagons
// specifically.
export function pointsToSvgAttr(points: readonly Point[]): string {
	return points.map(p => `${p.x},${p.y}`).join(' ')
}
