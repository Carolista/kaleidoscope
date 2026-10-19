import { describe, expect, it } from 'vitest'
import { compareSetOrder, memberSetOrderKey } from './setOrder'

describe('set order', () => {
	const sets = [
		{ row: { name: 'Beta set' }, members: [{ id: 'z' }, { id: 'a' }] },
		{ row: { name: 'Alpha set' }, members: [{ id: 'm' }] },
	]

	it('locates members by set name and position, and leaves others unassigned', () => {
		expect(memberSetOrderKey({ id: 'a', name: 'A' }, sets)).toEqual({
			setName: 'Beta set',
			position: 1,
			name: 'A',
		})
		expect(memberSetOrderKey({ id: 'x', name: 'X' }, sets)).toEqual({
			setName: null,
			position: null,
			name: 'X',
		})
	})

	it('sorts by set name, then position, then unassigned items by name', () => {
		const items = [
			{ id: 'y', name: 'Y' },
			{ id: 'a', name: 'A' },
			{ id: 'x', name: 'X' },
			{ id: 'z', name: 'Z' },
			{ id: 'm', name: 'M' },
		]
		expect(
			items
				.sort((a, b) =>
					compareSetOrder(
						memberSetOrderKey(a, sets),
						memberSetOrderKey(b, sets),
					),
				)
				.map(item => item.id),
		).toEqual(['m', 'z', 'a', 'x', 'y'])
	})
})
