// Hex/HSL color helpers for the hover-highlight effect on a painted hexagon:
// if it's already base or accent (and therefore has no "color" to
// brighten), fall back to a fixed neutral gray; otherwise brighten and
// saturate the hex's own color a bit, so the hover feedback always reads
// as "this one, lit up" rather than muddying the shape with a translucent
// overlay or darkening filter.

interface Rgb {
	readonly r: number
	readonly g: number
	readonly b: number
}

interface Hsl {
	readonly h: number
	readonly s: number
	readonly l: number
}

function hexToRgb(hex: string): Rgb {
	const normalized = hex.replace('#', '')
	return {
		r: parseInt(normalized.substring(0, 2), 16),
		g: parseInt(normalized.substring(2, 4), 16),
		b: parseInt(normalized.substring(4, 6), 16),
	}
}

function rgbToHex({ r, g, b }: Rgb): string {
	const toHex = (n: number) =>
		Math.round(Math.min(255, Math.max(0, n)))
			.toString(16)
			.padStart(2, '0')
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
	const rn = r / 255
	const gn = g / 255
	const bn = b / 255
	const max = Math.max(rn, gn, bn)
	const min = Math.min(rn, gn, bn)
	const l = (max + min) / 2

	if (max === min) {
		return { h: 0, s: 0, l: l * 100 }
	}

	const d = max - min
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
	let h: number
	switch (max) {
		case rn:
			h = (gn - bn) / d + (gn < bn ? 6 : 0)
			break
		case gn:
			h = (bn - rn) / d + 2
			break
		default:
			h = (rn - gn) / d + 4
	}
	return { h: (h / 6) * 360, s: s * 100, l: l * 100 }
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
	const hn = h / 360
	const sn = s / 100
	const ln = l / 100

	if (sn === 0) {
		const gray = ln * 255
		return { r: gray, g: gray, b: gray }
	}

	const hue2rgb = (p: number, q: number, t: number) => {
		let tt = t
		if (tt < 0) tt += 1
		if (tt > 1) tt -= 1
		if (tt < 1 / 6) return p + (q - p) * 6 * tt
		if (tt < 1 / 2) return q
		if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
		return p
	}

	const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
	const p = 2 * ln - q
	return {
		r: hue2rgb(p, q, hn + 1 / 3) * 255,
		g: hue2rgb(p, q, hn) * 255,
		b: hue2rgb(p, q, hn - 1 / 3) * 255,
	}
}

// Fixed fallback used when there's no hue to brighten (see above).
export const NEUTRAL_HOVER_FILL = '#808080'

const SATURATION_BOOST = 20
const LIGHTNESS_BOOST = 12
const MAX_LIGHTNESS = 92

export function brightenAndSaturate(hex: string): string {
	const hsl = rgbToHsl(hexToRgb(hex))
	return rgbToHex(
		hslToRgb({
			h: hsl.h,
			s: Math.min(100, hsl.s + SATURATION_BOOST),
			l: Math.min(MAX_LIGHTNESS, hsl.l + LIGHTNESS_BOOST),
		}),
	)
}

export function getHoverFill(
	fill: string,
	base: string,
	accent: string,
): string {
	if (fill === base || fill === accent) return NEUTRAL_HOVER_FILL
	return brightenAndSaturate(fill)
}
