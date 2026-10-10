import { describe, expect, it } from 'vitest'
import { groupCells } from './groupCells'

describe('groupCells', () => {
	it('preserves first-seen group order and member order, including numeric-looking IDs', () => {
		const cells = [
			{ groupId: '10', value: 'first' },
			{ groupId: '2', value: 'second' },
			{ groupId: '10', value: 'third' },
			{ groupId: '1', value: 'fourth' },
		] as const
		const groups = groupCells(cells)

		expect([...groups.keys()]).toEqual(['10', '2', '1'])
		expect(groups.get('10')).toEqual([cells[0], cells[2]])
		expect(groups.get('2')).toEqual([cells[1]])
		expect(groups.get('1')).toEqual([cells[3]])
		expect(groups.get('10')?.[0]).toBe(cells[0])
	})

	it('does not mutate the input and creates independent group arrays for each call', () => {
		const cell = Object.freeze({ groupId: 'a' })
		const cells = Object.freeze([cell])
		const first = groupCells(cells)
		const second = groupCells(cells)
		first.get('a')?.push(cell)

		expect(cells).toEqual([cell])
		expect(second.get('a')).toEqual([cell])
	})

	it('returns an empty map for no cells', () => {
		expect(groupCells([]).size).toBe(0)
	})
})
