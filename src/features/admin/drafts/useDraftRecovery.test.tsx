import { act, render, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DraftScopeProvider from './DraftScopeProvider'
import { DRAFT_MAX_AGE_MS, readDraft, writeDraft } from './draftStorage'
import useDraftRecovery from './useDraftRecovery'

const parse = (raw: unknown) => (typeof raw === 'string' ? raw : null)

function wrapper(userId: string) {
	return ({ children }: { children: ReactNode }) => (
		<DraftScopeProvider userId={userId}>{children}</DraftScopeProvider>
	)
}

function setup(userId: string, props: { dirty: boolean; snapshot: string }) {
	const onRestore = vi.fn()
	const hook = renderHook(
		(value: typeof props) =>
			useDraftRecovery<string>({
				key: 'item',
				parse,
				onRestore,
				...value,
			}),
		{ wrapper: wrapper(userId), initialProps: props },
	)
	return { ...hook, onRestore }
}

beforeEach(() => localStorage.clear())
afterEach(() => {
	localStorage.clear()
	vi.useRealTimers()
})

describe('useDraftRecovery', () => {
	it('persists only while dirty and clears once clean', () => {
		const { rerender } = setup('a', { dirty: true, snapshot: 'one' })
		expect(readDraft('a', 'item')).toBe('one')
		rerender({ dirty: true, snapshot: 'two' })
		expect(readDraft('a', 'item')).toBe('two')
		rerender({ dirty: false, snapshot: 'two' })
		expect(readDraft('a', 'item')).toBeNull()
	})

	it('holds a stored draft until restored or discarded', () => {
		writeDraft('a', 'item', 'saved')
		const { result, rerender, onRestore } = setup('a', {
			dirty: false,
			snapshot: 'fresh',
		})
		expect(result.current.pending).toBe(true)
		rerender({ dirty: true, snapshot: 'typing' })
		expect(readDraft('a', 'item')).toBe('saved')
		act(() => result.current.restore())
		expect(onRestore).toHaveBeenCalledWith('saved')
		expect(result.current.pending).toBe(false)
		rerender({ dirty: true, snapshot: 'saved' })
		expect(readDraft('a', 'item')).toBe('saved')
	})

	it('discards a stored draft', () => {
		writeDraft('a', 'item', 'saved')
		const { result } = setup('a', { dirty: false, snapshot: '' })
		act(() => result.current.discard())
		expect(result.current.pending).toBe(false)
		expect(readDraft('a', 'item')).toBeNull()
	})

	it('ignores invalid and expired drafts and other users’ drafts', () => {
		writeDraft('a', 'item', { not: 'a string' })
		expect(
			setup('a', { dirty: false, snapshot: '' }).result.current.pending,
		).toBe(false)
		writeDraft('b', 'item', 'theirs')
		expect(
			setup('a', { dirty: false, snapshot: '' }).result.current.pending,
		).toBe(false)
		vi.useFakeTimers()
		writeDraft('a', 'old', 'stale')
		vi.advanceTimersByTime(DRAFT_MAX_AGE_MS + 1)
		expect(readDraft('a', 'old')).toBeNull()
	})

	it('does nothing without a draft scope', () => {
		function Probe() {
			useDraftRecovery<string>({
				key: 'item',
				dirty: true,
				snapshot: 'x',
				parse,
				onRestore: () => {},
			})
			return null
		}
		render(<Probe />)
		expect(localStorage.length).toBe(0)
	})

	it('survives unavailable storage', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('Quota exceeded')
		})
		expect(() => setup('a', { dirty: true, snapshot: 'one' })).not.toThrow()
		vi.restoreAllMocks()
	})
})
