import type { ColorScheme } from '../types/colorScheme'

// Relative weights for picking a random paint color: scheme colors
// dominate so a randomized design still reads as a coherent kaleidoscope
// pattern instead of a mostly-neutral one. Base/accent act as occasional
// highlights, not the norm.
const SCHEME_COLOR_WEIGHT = 18
const NEUTRAL_COLOR_WEIGHT = 5

// Builds a flat, weighted pool of candidate colors: each scheme color
// repeated SCHEME_COLOR_WEIGHT times, base/accent repeated
// NEUTRAL_COLOR_WEIGHT times each — so a uniform pick from the pool
// reproduces the intended weighting without needing cumulative-probability
// math.
function weightedColorPool(
	scheme: ColorScheme,
	base: string,
	accent: string,
): readonly string[] {
	return [
		...scheme.colors.flatMap(color =>
			Array(SCHEME_COLOR_WEIGHT).fill(color),
		),
		...Array(NEUTRAL_COLOR_WEIGHT).fill(base),
		...Array(NEUTRAL_COLOR_WEIGHT).fill(accent),
	]
}

// `random` is injectable (defaults to `Math.random`) so tests can assert
// deterministic outcomes.
export function pickRandomPaintColor(
	scheme: ColorScheme,
	base: string,
	accent: string,
	random: () => number = Math.random,
): string {
	const pool = weightedColorPool(scheme, base, accent)
	return pool[Math.floor(random() * pool.length)]
}

// Assigns every given group id a randomly (weighted) chosen color, for the
// design randomizer.
export function generateRandomHexGroupColors(
	groupIds: readonly string[],
	scheme: ColorScheme,
	base: string,
	accent: string,
	random: () => number = Math.random,
): Record<string, string> {
	return Object.fromEntries(
		groupIds.map(groupId => [
			groupId,
			pickRandomPaintColor(scheme, base, accent, random),
		]),
	)
}
