import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/types/database'
import {
	bulkDeleteColorSchemes,
	loadColorSchemes,
	manageColorScheme,
	readColorScheme,
	type CatalogScheme,
	type SchemeAction,
} from './colorSchemes'

function client(value: object) {
	return value as SupabaseClient<Database>
}

const scheme: CatalogScheme = {
	id: 'stable-id',
	name: 'Test',
	colors: ['#112233', '#223344', '#334455', '#445566', '#556677'],
	revision: 3,
	published_at: null,
	release_at: null,
}

describe('palette catalog', () => {
	it('reads ordered colors, preserving duplicates and case', () => {
		const colors = ['#ABCdef', '#112233', '#112233', '#000000', '#ffffff']
		expect(readColorScheme({ ...scheme, colors })).toEqual({
			id: scheme.id,
			name: scheme.name,
			colors,
		})
	})

	it.each(
		[
			[],
			['#112233'],
			[...scheme.colors, '#abcdef'],
			['#123', ...scheme.colors.slice(1)],
			['112233', ...scheme.colors.slice(1)],
			['#gggggg', ...scheme.colors.slice(1)],
			[' #112233', ...scheme.colors.slice(1)],
		].map(colors => ({ colors })),
	)('rejects invalid ordered colors $colors', ({ colors }) => {
		expect(() => readColorScheme({ ...scheme, colors })).toThrow(
			'five six-digit hex colors',
		)
	})

	it('paginates by stable ID and returns all records sorted by name', async () => {
		const first = Array.from({ length: 1000 }, (_, index) => ({
			...scheme,
			id: `id-${index}`,
			name: `Z ${index}`,
		}))
		const range = vi
			.fn()
			.mockResolvedValueOnce({ data: first, error: null })
			.mockResolvedValueOnce({
				data: [{ ...scheme, id: 'last', name: 'A' }],
				error: null,
			})
		const order = vi.fn(() => ({ range }))
		const select = vi.fn(() => ({ order }))
		const from = vi.fn(() => ({ select }))
		const result = await loadColorSchemes(client({ from }))
		expect(result).toHaveLength(1001)
		expect(result[0].id).toBe('last')
		expect(result[0].revision).toBe(3)
		expect(from).toHaveBeenCalledWith('palettes')
		expect(select).toHaveBeenCalledWith('*')
		expect(order).toHaveBeenCalledWith('id')
		expect(range.mock.calls).toEqual([
			[0, 999],
			[1000, 1999],
		])
	})

	it('does not return a partial catalog if a later page fails', async () => {
		const range = vi
			.fn()
			.mockResolvedValueOnce({
				data: Array(1000).fill(scheme),
				error: null,
			})
			.mockResolvedValueOnce({
				data: null,
				error: { message: 'Offline' },
			})
		const from = () => ({
			select: () => ({ order: () => ({ range }) }),
		})
		await expect(loadColorSchemes(client({ from }))).rejects.toThrow(
			'Unable to load palettes: Offline',
		)
	})

	it('distinguishes an empty catalog from missing or invalid data', async () => {
		const range = vi.fn().mockResolvedValue({ data: [], error: null })
		const from = () => ({
			select: () => ({ order: () => ({ range }) }),
		})
		expect(await loadColorSchemes(client({ from }))).toEqual([])
		range.mockResolvedValue({ data: null, error: null })
		await expect(loadColorSchemes(client({ from }))).rejects.toThrow(
			'returned no data',
		)
		range.mockResolvedValue({
			data: [{ ...scheme, colors: ['#123'] }],
			error: null,
		})
		await expect(loadColorSchemes(client({ from }))).rejects.toThrow(
			'five six-digit hex colors',
		)
	})
})

describe('draft palette operations', () => {
	it.each([
		[
			{
				kind: 'create',
				id: 'new-id',
				scheme: { ...scheme, name: ' New ' },
			},
			{
				p_id: 'new-id',
				p_action: 'create',
				p_name: 'New',
				p_colors: [...scheme.colors],
			},
		],
		[
			{
				kind: 'update',
				previous: scheme,
				scheme: { ...scheme, name: ' Renamed ' },
			},
			{
				p_id: scheme.id,
				p_action: 'update',
				p_name: 'Renamed',
				p_colors: [...scheme.colors],
				p_expected_name: scheme.name,
				p_expected_colors: [...scheme.colors],
				p_expected_revision: 3,
			},
		],
		[
			{ kind: 'delete', previous: scheme },
			{
				p_id: scheme.id,
				p_expected_name: scheme.name,
				p_expected_colors: [...scheme.colors],
				p_expected_revision: 3,
			},
		],
	] satisfies [SchemeAction, object][])(
		'sends one verified %j operation',
		async (action, args) => {
			const id = action.kind === 'create' ? action.id : action.previous.id
			const rpc = vi.fn().mockResolvedValue({ data: id, error: null })
			await manageColorScheme(client({ rpc }), action)
			expect(rpc).toHaveBeenCalledExactlyOnceWith(
				action.kind === 'delete'
					? 'delete_palette_draft'
					: 'manage_palette_draft',
				args,
			)
		},
	)

	it('preserves the caller-provided create ID on retry', async () => {
		const rpc = vi
			.fn()
			.mockResolvedValueOnce({
				data: null,
				error: { message: 'Response lost' },
			})
			.mockResolvedValueOnce({ data: 'new-id', error: null })
		const action = { kind: 'create', id: 'new-id', scheme } as const
		await expect(
			manageColorScheme(client({ rpc }), action),
		).rejects.toThrow('Response lost')
		await manageColorScheme(client({ rpc }), action)
		expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1])
	})

	it('surfaces database conflicts and missing confirmations', async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: null,
			error: { message: 'Refresh and review before retrying.' },
		})
		const action = { kind: 'delete', previous: scheme } as const
		await expect(
			manageColorScheme(client({ rpc }), action),
		).rejects.toThrow('Refresh and review')
		for (const data of [null, 'other-id']) {
			rpc.mockResolvedValue({ data, error: null })
			await expect(
				manageColorScheme(client({ rpc }), action),
			).rejects.toThrow('not confirmed')
		}
	})

	it('rejects invalid IDs, names, and colors before requesting a write', async () => {
		const rpc = vi.fn()
		for (const id of ['', ' new-id ']) {
			await expect(
				manageColorScheme(client({ rpc }), {
					kind: 'create',
					id,
					scheme,
				}),
			).rejects.toThrow('permanent palette ID')
		}
		await expect(
			manageColorScheme(client({ rpc }), {
				kind: 'update',
				previous: scheme,
				scheme: { ...scheme, name: '   ' },
			}),
		).rejects.toThrow('Enter a name')
		await expect(
			manageColorScheme(client({ rpc }), {
				kind: 'create',
				id: 'new',
				scheme: {
					...scheme,
					colors: ['bad', '#223344', '#334455', '#445566', '#556677'],
				},
			}),
		).rejects.toThrow('five six-digit hex colors')
		expect(rpc).not.toHaveBeenCalled()
	})
})

describe('bulk palette deletion', () => {
	it('deletes every selected palette in one confirmed request', async () => {
		const rpc = vi.fn().mockResolvedValue({ data: ['b', 'a'], error: null })
		await bulkDeleteColorSchemes(client({ rpc }), ['a', 'b'])
		expect(rpc).toHaveBeenCalledExactlyOnceWith(
			'bulk_delete_palette_drafts',
			{ p_ids: ['a', 'b'] },
		)
		for (const data of [null, ['a'], ['a', 'a'], ['a', 'c']]) {
			rpc.mockResolvedValue({ data, error: null })
			await expect(
				bulkDeleteColorSchemes(client({ rpc }), ['a', 'b']),
			).rejects.toThrow('not confirmed')
		}
		rpc.mockResolvedValue({
			data: null,
			error: { message: 'Palette "A" is in a set' },
		})
		await expect(
			bulkDeleteColorSchemes(client({ rpc }), ['a', 'b']),
		).rejects.toThrow('Unable to delete palettes: Palette "A" is in a set')
	})
})
