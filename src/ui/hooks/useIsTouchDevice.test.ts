import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsTouchDevice } from './useIsTouchDevice'

// jsdom doesn't implement matchMedia at all, so each test installs its own
// minimal fake (and listener registry, for the change-event test) rather
// than relying on a real one.
function stubMatchMedia(initialMatches: boolean) {
	const listeners = new Set<(event: { matches: boolean }) => void>()
	let matches = initialMatches

	const mql = {
		get matches() {
			return matches
		},
		addEventListener: (
			_type: string,
			listener: (event: { matches: boolean }) => void,
		) => listeners.add(listener),
		removeEventListener: (
			_type: string,
			listener: (event: { matches: boolean }) => void,
		) => listeners.delete(listener),
	}

	vi.stubGlobal(
		'matchMedia',
		vi.fn().mockReturnValue(mql as unknown as MediaQueryList),
	)

	return {
		setMatches(next: boolean) {
			matches = next
			listeners.forEach(listener => listener({ matches }))
		},
	}
}

describe('useIsTouchDevice', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('returns false when matchMedia is unavailable', () => {
		vi.stubGlobal('matchMedia', undefined)
		const { result } = renderHook(() => useIsTouchDevice())
		expect(result.current).toBe(false)
	})

	it('reflects a matching touch-capability query on mount', () => {
		stubMatchMedia(true)
		const { result } = renderHook(() => useIsTouchDevice())
		expect(result.current).toBe(true)
	})

	it('reflects a non-matching query on mount', () => {
		stubMatchMedia(false)
		const { result } = renderHook(() => useIsTouchDevice())
		expect(result.current).toBe(false)
	})

	it('updates reactively when the query result changes (e.g. a hybrid device)', () => {
		const { setMatches } = stubMatchMedia(false)
		const { result } = renderHook(() => useIsTouchDevice())
		expect(result.current).toBe(false)

		act(() => setMatches(true))
		expect(result.current).toBe(true)
	})
})
