import { describe, expect, it } from 'vitest'
import { bands } from './bands'

describe('bands', () => {
	it('gives each color an equal diagonal band', () => {
		expect(bands(['#111111', '#222222', '#333333', '#444444'])).toBe(
			'linear-gradient(120deg, #111111 0% 25%, #222222 25% 50%, #333333 50% 75%, #444444 75% 100%)',
		)
	})

	it('fills the whole area with a single color', () => {
		expect(bands(['#abcdef'])).toBe(
			'linear-gradient(120deg, #abcdef 0% 100%)',
		)
	})
})
