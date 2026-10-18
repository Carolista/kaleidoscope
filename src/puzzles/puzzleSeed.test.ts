import { afterEach, expect, it, vi } from 'vitest'
import { createPuzzleSeed, createUnusedPuzzleSeed } from './puzzleSeed'

afterEach(() => vi.restoreAllMocks())

it('creates fixed-width random seeds without requiring randomUUID', () => {
	expect(createPuzzleSeed()).toMatch(/^[0-9a-f]{32}$/)
})

it('skips excluded seeds and bounds retries if randomness keeps repeating', () => {
	const random = vi
		.spyOn(crypto, 'getRandomValues')
		.mockImplementation(values => {
			if (!(values instanceof Uint32Array))
				throw new Error('Expected seed words')
			values.fill(1)
			return values
		})
	const excluded = new Set(['00000001000000010000000100000001'])
	expect(() => createUnusedPuzzleSeed(excluded)).toThrow('fresh puzzle seed')
	expect(random).toHaveBeenCalledTimes(32)
	random.mockImplementation(values => {
		if (!(values instanceof Uint32Array))
			throw new Error('Expected seed words')
		values.fill(2)
		return values
	})
	expect(createUnusedPuzzleSeed(excluded)).toBe(
		'00000002000000020000000200000002',
	)
	expect(excluded.size).toBe(1)
})
