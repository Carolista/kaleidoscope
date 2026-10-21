import { describe, expect, it } from 'vitest'
import {
	NEUTRAL_HOVER_FILL,
	brightenAndSaturate,
	getHoverFill,
	toGrayscale,
} from './colorMath'

describe('getHoverFill', () => {
	it('returns the neutral gray when the fill matches base', () => {
		expect(getHoverFill('#ffffff', '#ffffff', '#222222')).toBe(
			NEUTRAL_HOVER_FILL,
		)
	})

	it('returns the neutral gray when the fill matches accent', () => {
		expect(getHoverFill('#222222', '#ffffff', '#222222')).toBe(
			NEUTRAL_HOVER_FILL,
		)
	})

	it('brightens/saturates any other color rather than returning neutral gray', () => {
		const result = getHoverFill('#bc4749', '#ffffff', '#222222')
		expect(result).not.toBe(NEUTRAL_HOVER_FILL)
		expect(result).not.toBe('#bc4749')
	})
})

describe('brightenAndSaturate', () => {
	it('increases both saturation and lightness of a mid-tone color', () => {
		const original = '#bc4749' // a muted red
		const brightened = brightenAndSaturate(original)
		expect(brightened).not.toBe(original)
		// Sanity check via round-trip: brightened red channel should be higher
		// than the original for a color that isn't already near-white.
		const toRgb = (hex: string) => parseInt(hex.slice(1, 3), 16)
		expect(toRgb(brightened)).toBeGreaterThanOrEqual(toRgb(original))
	})

	it('clamps short of pure white for already-light colors', () => {
		const result = brightenAndSaturate('#fad4c0')
		expect(result).not.toBe('#ffffff')
	})

	it('is deterministic for the same input', () => {
		expect(brightenAndSaturate('#2ec4b6')).toBe(
			brightenAndSaturate('#2ec4b6'),
		)
	})
})

describe('toGrayscale', () => {
	it('removes the hue but keeps perceived brightness', () => {
		expect(toGrayscale('#000000')).toBe('#000000')
		expect(toGrayscale('#ffffff')).toBe('#ffffff')
		expect(toGrayscale('#808080')).toBe('#808080')
		for (const color of ['#ff0000', '#00ff00', '#0000ff', '#bc4749']) {
			const gray = toGrayscale(color)
			expect(gray).toMatch(/^#([0-9a-f]{2})\1\1$/)
		}
	})

	it('weights green above red above blue', () => {
		const level = (hex: string) =>
			parseInt(toGrayscale(hex).slice(1, 3), 16)
		expect(level('#00ff00')).toBeGreaterThan(level('#ff0000'))
		expect(level('#ff0000')).toBeGreaterThan(level('#0000ff'))
	})
})
