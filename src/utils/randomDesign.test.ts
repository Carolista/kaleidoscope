import { describe, expect, it } from 'vitest'
import type { ColorScheme } from '../types/colorScheme'
import {
	generateRandomShapeGroupColors,
	pickRandomPaintColor,
} from './randomDesign'

const SCHEME: ColorScheme = {
	name: 'Test Scheme',
	colors: ['#111111', '#222222', '#333333', '#444444', '#555555'],
}
const BASE = '#000000'

describe('pickRandomPaintColor', () => {
	it('weights scheme colors far more heavily than base (90% scheme, 10% base)', () => {
		// The pool is 5 scheme colors x 18 + base x 10 = 100 entries;
		// random() in [0, 1) maps linearly onto pool index.
		expect(pickRandomPaintColor(SCHEME, BASE, () => 0)).toBe(
			SCHEME.colors[0],
		)
		expect(pickRandomPaintColor(SCHEME, BASE, () => 0.89)).toBe(
			SCHEME.colors[4],
		)
		expect(pickRandomPaintColor(SCHEME, BASE, () => 0.9)).toBe(BASE)
		expect(pickRandomPaintColor(SCHEME, BASE, () => 0.99)).toBe(BASE)
	})

	it('only ever returns one of the scheme colors or base (never accent)', () => {
		const possible = new Set([...SCHEME.colors, BASE])
		for (let i = 0; i < 50; i++) {
			expect(possible).toContain(pickRandomPaintColor(SCHEME, BASE))
		}
	})
})

describe('generateRandomShapeGroupColors', () => {
	it('assigns a color to every given group id', () => {
		const groupIds = ['a', 'b', 'c']
		const result = generateRandomShapeGroupColors(groupIds, SCHEME, BASE)
		expect(Object.keys(result).sort()).toEqual(groupIds.sort())
	})

	it('is deterministic given a fixed random function', () => {
		const groupIds = ['a', 'b']
		const result = generateRandomShapeGroupColors(
			groupIds,
			SCHEME,
			BASE,
			() => 0,
		)
		expect(result).toEqual({ a: SCHEME.colors[0], b: SCHEME.colors[0] })
	})
})
