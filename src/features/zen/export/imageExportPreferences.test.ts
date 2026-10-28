import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	getIncludeGridLines,
	getTransparentBackground,
	saveIncludeGridLines,
	saveTransparentBackground,
} from './imageExportPreferences'

describe('image export preferences', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('defaults to including grid lines', () => {
		expect(getIncludeGridLines()).toBe(true)
	})

	it('remembers either choice independently of the saved design', () => {
		saveIncludeGridLines(false)
		localStorage.setItem('kaleidoscope:design', 'a different design')
		expect(getIncludeGridLines()).toBe(false)

		saveIncludeGridLines(true)
		localStorage.removeItem('kaleidoscope:design')
		expect(getIncludeGridLines()).toBe(true)
	})

	it('defaults to an opaque background and remembers the choice', () => {
		expect(getTransparentBackground()).toBe(false)
		saveTransparentBackground(true)
		expect(getTransparentBackground()).toBe(true)
		saveTransparentBackground(false)
		expect(getTransparentBackground()).toBe(false)
	})

	it.each(['getItem', 'setItem'] as const)(
		'logs unavailable storage during %s without blocking export',
		method => {
			const storage = vi
				.spyOn(Storage.prototype, method)
				.mockImplementation(() => {
					throw new Error('Storage unavailable')
				})
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
			try {
				if (method === 'getItem')
					expect(getIncludeGridLines()).toBe(true)
				else expect(() => saveIncludeGridLines(false)).not.toThrow()
				expect(warn).toHaveBeenCalledOnce()
			} finally {
				storage.mockRestore()
				warn.mockRestore()
			}
		},
	)
})
