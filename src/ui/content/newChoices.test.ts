import { beforeEach, describe, expect, it } from 'vitest'
import { loadSeenChoices, saveSeenChoices, unseenChoices } from './newChoices'

const seen = { palettes: new Set(['a']), shapes: new Set(['hexagon']) }

describe('seen choices', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('is empty until something is saved', () => {
		expect(loadSeenChoices(null)).toBeNull()
	})

	it('keeps a record for the guest and for each account', () => {
		saveSeenChoices(null, seen)
		saveSeenChoices('user-1', {
			palettes: new Set(['b']),
			shapes: new Set(),
		})
		expect(loadSeenChoices(null)).toEqual(seen)
		expect(loadSeenChoices('user-1')?.palettes).toEqual(new Set(['b']))
		expect(loadSeenChoices('user-2')).toBeNull()
	})

	it('ignores a damaged record', () => {
		localStorage.setItem('kaleidoscope:seen-choices:guest', '{')
		expect(loadSeenChoices(null)).toBeNull()
		localStorage.setItem(
			'kaleidoscope:seen-choices:guest',
			JSON.stringify({ version: 1, palettes: [1], shapes: [] }),
		)
		expect(loadSeenChoices(null)).toBeNull()
	})

	it('reports only what has not been seen', () => {
		expect(unseenChoices([{ id: 'a' }], ['hexagon'], seen)).toEqual({
			palettes: false,
			shapes: false,
		})
		expect(
			unseenChoices(
				[{ id: 'a' }, { id: 'b' }],
				['hexagon', 'star'],
				seen,
			),
		).toEqual({ palettes: true, shapes: true })
	})
})
