import { describe, expect, it } from 'vitest'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
	it('uses an Error’s own message', () => {
		expect(errorMessage(new Error('Network down'), 'Fallback')).toBe(
			'Network down',
		)
	})

	it.each([undefined, 'text', { message: 'not an Error' }])(
		'falls back for non-Error value %j',
		cause => {
			expect(errorMessage(cause, 'Fallback')).toBe('Fallback')
		},
	)
})
