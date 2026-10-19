import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import type { PaletteSet } from '@/features/admin/services'
import { AdminCatalogProvider } from './AdminCatalog'
import { useCatalog, useCatalogInvalidation } from './useAdminCatalog'

const mocks = vi.hoisted(() => ({
	paletteSets: vi.fn(),
	puzzleSets: vi.fn(),
}))
vi.mock('@/features/admin/services/paletteSets', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/paletteSets')
	>()),
	loadPaletteSets: (...args: unknown[]) => mocks.paletteSets(...args),
}))
vi.mock('@/features/admin/services/puzzleSets', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/puzzleSets')
	>()),
	loadDraftSets: (...args: unknown[]) => mocks.puzzleSets(...args),
}))

const client = {} as SupabaseClient<Database>
const set = (name: string) =>
	({
		row: { id: name, name },
		kind: 'core',
		members: [],
	}) as never as PaletteSet
const wrapper = ({ children }: { children: ReactNode }) => (
	<AdminCatalogProvider>{children}</AdminCatalogProvider>
)
function useHarness(enabled = true) {
	return {
		catalog: useCatalog('paletteSets', client, enabled),
		invalidate: useCatalogInvalidation(),
	}
}

beforeEach(() => {
	vi.resetAllMocks()
	mocks.paletteSets.mockResolvedValue([set('First')])
})

describe('admin catalog cache', () => {
	it('loads once per provider instead of on every render', async () => {
		const first = renderHook(() => useHarness(), { wrapper })
		await waitFor(() =>
			expect(first.result.current.catalog.data).toBeDefined(),
		)
		first.rerender()
		expect(mocks.paletteSets).toHaveBeenCalledExactlyOnceWith(client)
	})

	it('invalidates only loaded keys and keeps data visible while refreshing', async () => {
		const { result } = renderHook(() => useHarness(), { wrapper })
		await waitFor(() => expect(result.current.catalog.loading).toBe(false))
		mocks.paletteSets.mockResolvedValue([set('Second')])
		act(() => result.current.invalidate('paletteSets', 'puzzleSets'))
		expect(result.current.catalog.refreshing).toBe(true)
		expect(result.current.catalog.data?.[0].row.name).toBe('First')
		await waitFor(() =>
			expect(result.current.catalog.data?.[0].row.name).toBe('Second'),
		)
		expect(mocks.puzzleSets).not.toHaveBeenCalled()
	})

	it('keeps local updates over an older in-flight response', async () => {
		const { result } = renderHook(() => useHarness(), { wrapper })
		await waitFor(() => expect(result.current.catalog.loading).toBe(false))
		let resolve: (value: PaletteSet[]) => void = () => {}
		mocks.paletteSets.mockReturnValueOnce(
			new Promise(done => {
				resolve = done
			}),
		)
		act(() => result.current.invalidate('paletteSets'))
		act(() => result.current.catalog.update(() => [set('Local')]))
		await act(async () => resolve([set('Stale')]))
		expect(result.current.catalog.data?.[0].row.name).toBe('Local')
		expect(result.current.catalog.refreshing).toBe(false)
	})

	it('skips disabled keys and recovers from failures on refresh', async () => {
		mocks.paletteSets.mockRejectedValueOnce(new Error('Offline'))
		const disabled = renderHook(() => useHarness(false), { wrapper })
		expect(disabled.result.current.catalog.loading).toBe(false)
		expect(mocks.paletteSets).not.toHaveBeenCalled()
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
