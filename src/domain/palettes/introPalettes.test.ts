import { describe, expect, it } from 'vitest'
import type { PlayerPalette } from './palette'
import { findIntroPalette, INTRO_PALETTE_IDS } from './introPalettes'

const palette = (id: string): PlayerPalette => ({
	id,
	name: id,
	colors: ['#111111', '#222222', '#333333', '#444444', '#555555'],
})

describe('findIntroPalette', () => {
	const others = [palette('a'), palette('b')]

	it.each(['zen', 'basic', 'rotation'] as const)(
		'picks the %s tutorial palette by ID',
		key => {
			const chosen = palette(INTRO_PALETTE_IDS[key])
			expect(findIntroPalette([...others, chosen], key)).toBe(chosen)
		},
	)

	it('falls back to the first palette when the tutorial palette is missing', () => {
		expect(findIntroPalette(others, 'basic')).toBe(others[0])
	})
})
