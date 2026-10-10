import { describe, expect, it, vi } from 'vitest'
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
	it('preserves every weighted pool slot and consumes one random value per group in order', () => {
		const groupIds = Array.from(
			{ length: 100 },
			(_, index) => `group-${index}`,
		)
		const random = vi.fn()
		for (let index = 0; index < 100; index++) {
			random.mockReturnValueOnce((index + 0.5) / 100)
		}
		const result = generateRandomShapeGroupColors(
			groupIds,
			SCHEME,
			BASE,
			random,
		)
		expect(Object.keys(result)).toEqual(groupIds)
		expect(random).toHaveBeenCalledTimes(groupIds.length)
		const expected = [
			...SCHEME.colors.flatMap(color => Array(18).fill(color)),
			...Array(10).fill(BASE),
		]
		expect(Object.values(result)).toEqual(expected)
		for (let index = 0; index < 100; index++) {
			expect(result[groupIds[index]]).toBe(
				pickRandomPaintColor(SCHEME, BASE, () => (index + 0.5) / 100),
			)
		}
	})

	it('returns an empty design without consuming random values when there are no groups', () => {
		const random = vi.fn()
		expect(
			generateRandomShapeGroupColors([], SCHEME, BASE, random),
		).toEqual({})
		expect(random).not.toHaveBeenCalled()
	})

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
