import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database, Json } from '@/lib/supabase'
import {
	applyRelease,
	changedCounts,
	fromLocalInputValue,
	packageShapeOf,
	parseReleasePlan,
	previewRelease,
	toLocalInputValue,
} from './release'

function client(value: object) {
	return value as SupabaseClient<Database>
}

const item = (
	kind: string,
	id: string,
	change: string,
	state = 'draft',
): Json => ({
	kind,
	id,
	name: `Name ${id}`,
	state,
	change,
	previous_release_at: null,
	release_at: '2026-11-01T12:00:00+00:00',
})

const plan = (overrides: Record<string, Json> = {}): Json => ({
	action: 'schedule',
	kind: 'puzzle_group',
	id: 'g1',
	name: 'Core basic',
	state: 'draft',
	release_at: '2026-11-01T12:00:00+00:00',
	items: [
		item('palette', 'p1', 'release'),
		item('puzzle', 'z1', 'release'),
		item('puzzle', 'z2', 'keep', 'scheduled'),
		item('puzzle_group', 'g1', 'release'),
	],
	blockers: [],
	warnings: ['Palette "X" is awarded by more than one group.'],
	...overrides,
})

describe('parseReleasePlan', () => {
	it('reads the database plan into camelCase fields', () => {
		const parsed = parseReleasePlan(plan())
		expect(parsed).toMatchObject({
			action: 'schedule',
			kind: 'puzzle_group',
			id: 'g1',
			name: 'Core basic',
			state: 'draft',
			releaseAt: '2026-11-01T12:00:00+00:00',
			blockers: [],
			warnings: ['Palette "X" is awarded by more than one group.'],
		})
		expect(parsed.items).toHaveLength(4)
		expect(parsed.items[2]).toEqual({
			kind: 'puzzle',
			id: 'z2',
			name: 'Name z2',
			state: 'scheduled',
			change: 'keep',
			previousReleaseAt: null,
			releaseAt: '2026-11-01T12:00:00+00:00',
		})
	})

	it('accepts a shape package plan', () => {
		expect(
			parseReleasePlan(
				plan({
					kind: 'shape_package',
					id: 'hexagon',
					name: 'Hexagon package',
				}),
			),
		).toMatchObject({ kind: 'shape_package', id: 'hexagon' })
	})

	it('accepts a cancel plan with no release time', () => {
		expect(
			parseReleasePlan(plan({ action: 'cancel', release_at: null }))
				.releaseAt,
		).toBeNull()
	})

	it.each([
		['null', null],
		['an array', []],
		['an unknown action', plan({ action: 'delete' })],
		['an unknown kind', plan({ kind: 'shape' })],
		['an unknown state', plan({ state: 'archived' })],
		['no items', plan({ items: null })],
		['a bad item', plan({ items: [item('puzzle', 'z', 'explode')] })],
		['a non-object item', plan({ items: ['x'] })],
		['non-text blockers', plan({ blockers: [1] })],
		['no warnings list', plan({ warnings: 'none' })],
	])('rejects %s', (_label, value) => {
		expect(() => parseReleasePlan(value as Json)).toThrow('malformed')
	})
})

describe('release calls', () => {
	it('previews with the request arguments and omits an empty time', async () => {
		const rpc = vi.fn().mockResolvedValue({ data: plan(), error: null })
		const result = await previewRelease(client({ rpc }), {
			action: 'schedule',
			kind: 'puzzle_group',
			id: 'g1',
		})
		expect(rpc).toHaveBeenCalledExactlyOnceWith('preview_release', {
			p_action: 'schedule',
			p_kind: 'puzzle_group',
			p_id: 'g1',
		})
		expect(result.name).toBe('Core basic')
	})

	it('applies with a release time', async () => {
		const rpc = vi.fn().mockResolvedValue({ data: plan(), error: null })
		await applyRelease(client({ rpc }), {
			action: 'schedule',
			kind: 'palette_group',
			id: 'g2',
			releaseAt: '2026-11-01T12:00:00.000Z',
		})
		expect(rpc).toHaveBeenCalledExactlyOnceWith('apply_release', {
			p_action: 'schedule',
			p_kind: 'palette_group',
			p_id: 'g2',
			p_release_at: '2026-11-01T12:00:00.000Z',
		})
	})

	it('reports database errors and malformed answers', async () => {
		const rpc = vi.fn()
		rpc.mockResolvedValue({ data: null, error: { message: 'Blocked' } })
		const request = {
			action: 'cancel',
			kind: 'palette_group',
			id: 'p1',
		} as const
		await expect(previewRelease(client({ rpc }), request)).rejects.toThrow(
			'Unable to check the release: Blocked',
		)
		await expect(applyRelease(client({ rpc }), request)).rejects.toThrow(
			'Unable to change the release: Blocked',
		)
		rpc.mockResolvedValue({ data: 'nope', error: null })
		await expect(applyRelease(client({ rpc }), request)).rejects.toThrow(
			'malformed',
		)
	})
})

describe('changedCounts', () => {
	it('counts only items the plan changes', () => {
		expect(changedCounts(parseReleasePlan(plan()))).toEqual({
			palette: 1,
			puzzle: 1,
			puzzle_group: 1,
			palette_group: 0,
		})
	})
})

describe('local time values', () => {
	it('round-trips an instant through a datetime-local value', () => {
		const instant = new Date(2026, 10, 1, 9, 5)
		const value = toLocalInputValue(instant)
		expect(value).toBe('2026-11-01T09:05')
		expect(fromLocalInputValue(value)).toBe(instant.toISOString())
	})

	it('treats an empty or invalid value as no time', () => {
		expect(fromLocalInputValue('')).toBeNull()
		expect(fromLocalInputValue('not a date')).toBeNull()
	})
})

describe('packageShapeOf', () => {
	it('names the shape for core and bonus groups in a slot', () => {
		expect(
			packageShapeOf({
				purpose: 'core',
				shape_id: 'hexagon',
				track: 'basic',
			}),
		).toBe('hexagon')
		expect(
			packageShapeOf({
				purpose: 'reward',
				shape_id: 'triangle',
				track: 'rotation',
			}),
		).toBe('triangle')
	})

	it('is null for groups released on their own', () => {
		for (const group of [
			{ purpose: 'daily', shape_id: null, track: null },
			{ purpose: 'pack', shape_id: 'hexagon', track: 'basic' },
			{ purpose: 'undecided', shape_id: 'hexagon', track: null },
			{ purpose: 'core', shape_id: 'hexagon', track: null },
			{ purpose: 'core', shape_id: null, track: 'basic' },
			{ purpose: null, shape_id: 'hexagon', track: 'basic' },
		])
			expect(packageShapeOf(group)).toBeNull()
	})
})
