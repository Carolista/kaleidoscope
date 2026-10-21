import type { Palette } from '@/domain/palettes'

// Relative weights for picking a random paint color: palette colors
// dominate so a randomized design still reads as a coherent kaleidoscope
// pattern instead of a mostly-neutral one. Base acts as an occasional
// highlight, not the norm. Accent is deliberately excluded: it's also the
// default fill for an unpainted group (see HexagonGrid's `?? accent`), so
// "painting" a cell accent would look identical to never painting it.
const PALETTE_COLOR_WEIGHT = 18
const NEUTRAL_COLOR_WEIGHT = 10

// Builds a flat, weighted pool of candidate colors: each palette color
// repeated PALETTE_COLOR_WEIGHT times, base repeated NEUTRAL_COLOR_WEIGHT
// times — so a uniform pick from the pool reproduces the intended
// weighting without needing cumulative-probability math.
function weightedColorPool(palette: Palette, base: string): readonly string[] {
	return [
		...palette.colors.flatMap(color =>
			Array(PALETTE_COLOR_WEIGHT).fill(color),
		),
		...Array(NEUTRAL_COLOR_WEIGHT).fill(base),
	]
}

// `random` is injectable (defaults to `Math.random`) so tests can assert
// deterministic outcomes.
export function pickRandomPaintColor(
	palette: Palette,
	base: string,
	random: () => number = Math.random,
): string {
	const pool = weightedColorPool(palette, base)
	return pool[Math.floor(random() * pool.length)]
}

// Assigns every given group id a randomly (weighted) chosen color, for the
// design randomizer.
export function generateRandomShapeGroupColors(
	groupIds: readonly string[],
	palette: Palette,
	base: string,
	random: () => number = Math.random,
): Record<string, string> {
	const pool = weightedColorPool(palette, base)
	return Object.fromEntries(
		groupIds.map(groupId => [
			groupId,
			pool[Math.floor(random() * pool.length)],
		]),
	)
}
