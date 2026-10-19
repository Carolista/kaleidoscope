import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../types/database'
import {
	loadSchemeSets,
	manageSchemeSet,
	type SchemeSetAction,
} from './schemeSets'

const row = {
	id: 'set-one',
	name: 'Colors',
	kind: 'undecided',
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
	const sets = vi.fn().mockResolvedValue({ data: [row], error: null })
	const members = vi
		.fn()
		.mockResolvedValue({
			data: [{ palette_id: 'art', position: 1, palettes: palette }],
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
				range: table === 'palette_packs' ? sets : members,
			}
			return query
		},
	})
	return { client, sets, members, selects, orders, filters }
}

describe('palette set catalog', () => {
	it('loads ordered palette swatches and label metadata', async () => {
		const { client, selects, orders, filters } = setup()
		expect(await loadSchemeSets(client)).toEqual([
			{ row, kind: 'undecided', members: [palette] },
		])
		expect(selects).toHaveBeenCalledWith(
			'palette_pack_palettes',
			'palette_id, position, palettes(id, name, colors)',
		)
		expect(orders).toHaveBeenCalledWith('palette_pack_palettes', 'position')
		expect(filters).toHaveBeenCalledWith(
			'palette_pack_palettes',
			'pack_id',
			row.id,
		)
	})

	it('paginates both set records and membership without truncating', async () => {
		const { client, sets, members } = setup()
		sets.mockResolvedValueOnce({ data: Array(1000).fill(row), error: null })
		members.mockResolvedValueOnce({
			data: Array(1000).fill({
				palette_id: 'art',
				position: 1,
				palettes: palette,
			}),
			error: null,
		})
		const result = await loadSchemeSets(client)
		expect(result).toHaveLength(1001)
		expect(result[0].members).toHaveLength(1001)
		expect(sets.mock.calls).toEqual([
			[0, 999],
			[1000, 1999],
		])
		expect(members.mock.calls.slice(0, 2)).toEqual([
			[0, 999],
			[1000, 1999],
		])
	})

	it.each(['sets', 'members'] as const)(
		'reports %s read errors and missing data explicitly',
		async key => {
			const setupResult = setup()
			setupResult[key].mockResolvedValueOnce({
				data: null,
				error: { message: 'Offline' },
			})
			await expect(loadSchemeSets(setupResult.client)).rejects.toThrow(
				'Offline',
			)
			setupResult[key].mockResolvedValueOnce({ data: null, error: null })
			await expect(loadSchemeSets(setupResult.client)).rejects.toThrow(
				'returned no data',
			)
		},
	)

	it('rejects unsupported labels, unresolved members and malformed colors', async () => {
		const { client, sets, members } = setup()
		sets.mockResolvedValueOnce({
			data: [{ ...row, kind: 'free' }],
			error: null,
		})
		await expect(loadSchemeSets(client)).rejects.toThrow(
			'unsupported label',
		)
		members.mockResolvedValueOnce({
			data: [{ palettes: null }],
			error: null,
		})
		await expect(loadSchemeSets(client)).rejects.toThrow(
			'could not be resolved',
		)
		members.mockResolvedValueOnce({
			data: [{ palettes: { ...palette, colors: ['#bad'] } }],
			error: null,
		})
		await expect(loadSchemeSets(client)).rejects.toThrow(
			'five six-digit hex colors',
		)
	})
})

describe('palette set operations', () => {
	it.each([
		[
			{ kind: 'create', name: ' New ', role: 'undecided' },
			{ p_name: 'New', p_kind: 'undecided' },
		],
		[
			{ kind: 'update', name: ' Renamed ', role: 'reward' },
			{ p_name: 'Renamed', p_kind: 'reward' },
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
	] satisfies [SchemeSetAction, object][])(
		'confirms one %j request',
		async (action, args) => {
			const rpc = vi.fn().mockResolvedValue({ data: row.id, error: null })
			await manageSchemeSet(clientFrom({ rpc }), row.id, action)
			expect(rpc).toHaveBeenCalledExactlyOnceWith('manage_palette_set', {
				p_id: row.id,
				p_action: action.kind,
				...args,
			})
		},
	)

	it('reports server failures and mismatched write confirmations', async () => {
		const rpc = vi
			.fn()
			.mockResolvedValue({
				data: null,
				error: { message: 'Cannot move published membership' },
			})
		const client = clientFrom({ rpc })
		await expect(
			manageSchemeSet(client, row.id, {
				kind: 'assign',
				paletteIds: ['art'],
			}),
		).rejects.toThrow('Cannot move published membership')
		for (const data of [null, 'another-set']) {
			rpc.mockResolvedValue({ data, error: null })
			await expect(
				manageSchemeSet(client, row.id, { kind: 'delete' }),
			).rejects.toThrow('not confirmed')
		}
	})
})
