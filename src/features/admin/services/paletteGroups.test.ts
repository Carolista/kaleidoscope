import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/supabase'
import {
	loadPaletteGroups,
	managePaletteGroup,
	type PaletteGroupAction,
} from './paletteGroups'

const row = {
	id: 'group-one',
	name: 'Colors',
	purpose: 'undecided',
	published_at: null,
	release_at: null,
}
const palette = {
	id: 'art',
	name: 'Art',
	colors: ['#112233', '#223344', '#334455', '#445566', '#556677'],
}
function clientFrom(value: object) {
	return value as SupabaseClient<Database>
}
function setup() {
	const groups = vi.fn().mockResolvedValue({ data: [row], error: null })
	const members = vi.fn().mockResolvedValue({
		data: [{ group_id: row.id, position: 1, palettes: palette }],
		error: null,
	})
	const selects = vi.fn()
	const orders = vi.fn()
	const filters = vi.fn()
	const client = clientFrom({
		from: (table: string) => {
			const query = {
				select: (columns: string) => {
					selects(table, columns)
					return query
				},
				order: (column: string) => {
					orders(table, column)
					return query
				},
				eq: (column: string, value: string) => {
					filters(table, column, value)
					return query
				},
				range: table === 'palette_groups' ? groups : members,
			}
			return query
		},
	})
	return { client, groups, members, selects, orders, filters }
}

describe('palette group catalog', () => {
	it('loads ordered palette swatches for every group in one membership query', async () => {
		const { client, selects, orders, filters, members } = setup()
		expect(await loadPaletteGroups(client)).toEqual([
			{ row, purpose: 'undecided', members: [palette] },
		])
		expect(selects).toHaveBeenCalledWith(
			'palette_group_members',
			'group_id, position, palettes(id, name, colors)',
		)
		expect(orders).toHaveBeenCalledWith('palette_group_members', 'group_id')
		expect(orders).toHaveBeenCalledWith('palette_group_members', 'position')
		expect(filters).not.toHaveBeenCalled()
		expect(members).toHaveBeenCalledOnce()
	})

	it('skips membership reads when there are no palette groups', async () => {
		const { client, groups, members } = setup()
		groups.mockResolvedValueOnce({ data: [], error: null })
		expect(await loadPaletteGroups(client)).toEqual([])
		expect(members).not.toHaveBeenCalled()
	})

	it('paginates both group records and membership without truncating', async () => {
		const { client, groups, members } = setup()
		groups.mockResolvedValueOnce({
			data: Array(1000).fill(row),
			error: null,
		})
		members.mockResolvedValueOnce({
			data: Array(1000).fill({
				group_id: row.id,
				position: 1,
				palettes: palette,
			}),
			error: null,
		})
		const result = await loadPaletteGroups(client)
		expect(result).toHaveLength(1001)
		expect(result[0].members).toHaveLength(1001)
		expect(groups.mock.calls).toEqual([
			[0, 999],
			[1000, 1999],
		])
		expect(members.mock.calls.slice(0, 2)).toEqual([
			[0, 999],
			[1000, 1999],
		])
	})

	it.each(['groups', 'members'] as const)(
		'reports %s read errors and missing data explicitly',
		async key => {
			const setupResult = setup()
			setupResult[key].mockResolvedValueOnce({
				data: null,
				error: { message: 'Offline' },
			})
			await expect(loadPaletteGroups(setupResult.client)).rejects.toThrow(
				'Offline',
			)
			setupResult[key].mockResolvedValueOnce({ data: null, error: null })
			await expect(loadPaletteGroups(setupResult.client)).rejects.toThrow(
				'returned no data',
			)
		},
	)

	it('rejects unsupported purposes, unresolved members and malformed colors', async () => {
		const { client, groups, members } = setup()
		groups.mockResolvedValueOnce({
			data: [{ ...row, purpose: 'paid' }],
			error: null,
		})
		await expect(loadPaletteGroups(client)).rejects.toThrow(
			'unsupported purpose',
		)
		members.mockResolvedValueOnce({
			data: [{ group_id: row.id, palettes: null }],
			error: null,
		})
		await expect(loadPaletteGroups(client)).rejects.toThrow(
			'could not be resolved',
		)
		members.mockResolvedValueOnce({
			data: [
				{
					group_id: row.id,
					palettes: { ...palette, colors: ['#bad'] },
				},
			],
			error: null,
		})
		await expect(loadPaletteGroups(client)).rejects.toThrow(
			'five six-digit hex colors',
		)
	})
})

describe('palette group operations', () => {
	it.each([
		[
			{ kind: 'create', name: ' New ', purpose: 'undecided' },
			{ p_name: 'New', p_purpose: 'undecided' },
		],
		[
			{ kind: 'update', name: ' Renamed ', purpose: 'reward' },
			{ p_name: 'Renamed', p_purpose: 'reward' },
		],
		[
			{ kind: 'assign', paletteIds: ['a', 'b'] },
			{ p_palette_ids: ['a', 'b'] },
		],
		[{ kind: 'remove', paletteIds: ['a'] }, { p_palette_ids: ['a'] }],
		[
			{ kind: 'reorder', paletteIds: ['b', 'a'] },
			{ p_palette_ids: ['b', 'a'] },
		],
		[{ kind: 'delete' }, {}],
	] satisfies [PaletteGroupAction, object][])(
		'confirms one %j request',
		async (action, args) => {
			const rpc = vi.fn().mockResolvedValue({ data: row.id, error: null })
			await managePaletteGroup(clientFrom({ rpc }), row.id, action)
			expect(rpc).toHaveBeenCalledExactlyOnceWith(
				'manage_palette_group',
				{
					p_id: row.id,
					p_action: action.kind,
					...args,
				},
			)
		},
	)

	it('reports server failures and mismatched write confirmations', async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: null,
			error: { message: 'Cannot move published membership' },
		})
		const client = clientFrom({ rpc })
		await expect(
			managePaletteGroup(client, row.id, {
				kind: 'assign',
				paletteIds: ['art'],
			}),
		).rejects.toThrow('Cannot move published membership')
		for (const data of [null, 'another-group']) {
			rpc.mockResolvedValue({ data, error: null })
			await expect(
				managePaletteGroup(client, row.id, { kind: 'delete' }),
			).rejects.toThrow('not confirmed')
		}
	})
})
