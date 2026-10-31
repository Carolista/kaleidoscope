// Diagonal bands, one per palette color.
export function bands(colors: readonly string[]) {
	const step = 100 / colors.length
	const stops = colors.map(
		(color, slot) => `${color} ${slot * step}% ${(slot + 1) * step}%`,
	)
	return `linear-gradient(120deg, ${stops.join(', ')})`
}
