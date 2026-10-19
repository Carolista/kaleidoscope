import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import useModalState from './useModalState'

describe('useModalState', () => {
	it('retains action content through closing and then releases it', () => {
		const { result } = renderHook(() => useModalState<{ name: string }>())
		const action = { name: 'Selected item' }
		expect(result.current[0]).toBeNull()
		act(() => result.current[1](action))
		expect(result.current[2].open).toBe(true)
		act(() => result.current[1](null))
		expect(result.current[2].open).toBe(false)
		expect(result.current[0]).toBe(action)
		act(() => result.current[2].onAfterClose())
		expect(result.current[0]).toBeNull()
	})

	it('defers navigation until exit finishes and calls it only once', () => {
		const { result } = renderHook(() => useModalState<true>())
		const leaveEditor = vi.fn()
		act(() => result.current[1](true))
		act(() => result.current[1](null, leaveEditor))
		expect(leaveEditor).not.toHaveBeenCalled()
		act(() => result.current[2].onAfterClose())
		act(() => result.current[2].onAfterClose())
		expect(leaveEditor).toHaveBeenCalledOnce()
	})

	it('clears stale after-close callbacks when reopening', () => {
		const { result } = renderHook(() => useModalState<string>())
		const stale = vi.fn()
		act(() => result.current[1]('First'))
		act(() => result.current[1](null, stale))
		act(() => result.current[1]('Second'))
		expect(result.current[0]).toBe('Second')
		expect(result.current[2].open).toBe(true)
		act(() => result.current[1](null))
		act(() => result.current[2].onAfterClose())
		expect(stale).not.toHaveBeenCalled()
	})
})
