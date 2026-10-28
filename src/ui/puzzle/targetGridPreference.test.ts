import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
	getTargetGridLines,
	saveTargetGridLines,
	useTargetGridLines,
} from './targetGridPreference'

const KEY = 'kaleidoscope:puzzle:targetGridLines'

describe('target grid lines preference', () => {
	afterEach(() => {
		localStorage.clear()
		saveTargetGridLines(true)
		localStorage.clear()
		vi.restoreAllMocks()
	})

	it('shows grid lines until told otherwise', () => {
		localStorage.clear()
		expect(getTargetGridLines()).toBe(true)
	})

	it('remembers the choice on the device', () => {
		saveTargetGridLines(false)
		expect(localStorage.getItem(KEY)).toBe('false')
		expect(getTargetGridLines()).toBe(false)
		saveTargetGridLines(true)
		expect(getTargetGridLines()).toBe(true)
	})

	it('updates everything using it at once', () => {
		const first = renderHook(() => useTargetGridLines())
		const second = renderHook(() => useTargetGridLines())
		act(() => first.result.current[1](false))
		expect(first.result.current[0]).toBe(false)
		expect(second.result.current[0]).toBe(false)
	})

	it('follows a change made in another tab', () => {
		const { result } = renderHook(() => useTargetGridLines())
		act(() => {
			localStorage.setItem(KEY, 'false')
			window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
		})
		expect(result.current[0]).toBe(false)
	})

	it('still works for the visit when storage is unavailable', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('denied')
		})
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('denied')
		})
		expect(getTargetGridLines()).toBe(true)
		saveTargetGridLines(false)
		expect(getTargetGridLines()).toBe(false)
	})
})
