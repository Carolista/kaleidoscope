import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import type { PaletteGroup } from '@/features/admin/services'
import { AdminCatalogProvider } from './AdminCatalog'
import { useCatalog, useCatalogInvalidation } from './useAdminCatalog'

const mocks = vi.hoisted(() => ({
	paletteGroups: vi.fn(),
	puzzleGroups: vi.fn(),
}))
vi.mock('@/features/admin/services/paletteGroups', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/paletteGroups')
	>()),
	loadPaletteGroups: (...args: unknown[]) => mocks.paletteGroups(...args),
}))
vi.mock('@/features/admin/services/puzzleGroups', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/puzzleGroups')
	>()),
	loadPuzzleGroups: (...args: unknown[]) => mocks.puzzleGroups(...args),
}))

const client = {} as SupabaseClient<Database>
const group = (name: string) =>
	({
		row: { id: name, name },
		purpose: 'core',
		members: [],
	}) as never as PaletteGroup
const wrapper = ({ children }: { children: ReactNode }) => (
	<AdminCatalogProvider>{children}</AdminCatalogProvider>
)
function useHarness(enabled = true) {
	return {
		catalog: useCatalog('paletteGroups', client, enabled),
		invalidate: useCatalogInvalidation(),
	}
}

beforeEach(() => {
	vi.resetAllMocks()
	mocks.paletteGroups.mockResolvedValue([group('First')])
})

describe('admin catalog cache', () => {
	it('loads once per provider instead of on every render', async () => {
		const first = renderHook(() => useHarness(), { wrapper })
		await waitFor(() =>
			expect(first.result.current.catalog.data).toBeDefined(),
		)
		first.rerender()
		expect(mocks.paletteGroups).toHaveBeenCalledExactlyOnceWith(client)
	})

	it('invalidates only loaded keys and keeps data visible while refreshing', async () => {
		const { result } = renderHook(() => useHarness(), { wrapper })
		await waitFor(() => expect(result.current.catalog.loading).toBe(false))
		mocks.paletteGroups.mockResolvedValue([group('Second')])
		act(() => result.current.invalidate('paletteGroups', 'puzzleGroups'))
		expect(result.current.catalog.refreshing).toBe(true)
		expect(result.current.catalog.data?.[0].row.name).toBe('First')
		await waitFor(() =>
			expect(result.current.catalog.data?.[0].row.name).toBe('Second'),
		)
		expect(mocks.puzzleGroups).not.toHaveBeenCalled()
	})

	it('keeps local updates over an older in-flight response', async () => {
		const { result } = renderHook(() => useHarness(), { wrapper })
		await waitFor(() => expect(result.current.catalog.loading).toBe(false))
		let resolve: (value: PaletteGroup[]) => void = () => {}
		mocks.paletteGroups.mockReturnValueOnce(
			new Promise(done => {
				resolve = done
			}),
		)
		act(() => result.current.invalidate('paletteGroups'))
		act(() => result.current.catalog.update(() => [group('Local')]))
		await act(async () => resolve([group('Stale')]))
		expect(result.current.catalog.data?.[0].row.name).toBe('Local')
		expect(result.current.catalog.refreshing).toBe(false)
	})

	it('skips disabled keys and recovers from failures on refresh', async () => {
		mocks.paletteGroups.mockRejectedValueOnce(new Error('Offline'))
		const disabled = renderHook(() => useHarness(false), { wrapper })
		expect(disabled.result.current.catalog.loading).toBe(false)
		expect(mocks.paletteGroups).not.toHaveBeenCalled()
		disabled.unmount()
		const failed = renderHook(() => useHarness(), { wrapper })
		await waitFor(() =>
			expect(failed.result.current.catalog.error).toBeInstanceOf(Error),
		)
		expect(failed.result.current.catalog.loading).toBe(false)
		await act(() => failed.result.current.catalog.refresh())
		expect(failed.result.current.catalog.data).toHaveLength(1)
		expect(failed.result.current.catalog.error).toBeUndefined()
	})
})
