import { describe, expect, it } from 'vitest'
import { compareGroupOrder, memberGroupOrderKey } from './groupOrder'

describe('group order', () => {
	const groups = [
		{ row: { name: 'Beta group' }, members: [{ id: 'z' }, { id: 'a' }] },
		{ row: { name: 'Alpha group' }, members: [{ id: 'm' }] },
	]

	it('locates members by group name and position, and leaves others unassigned', () => {
		expect(memberGroupOrderKey({ id: 'a', name: 'A' }, groups)).toEqual({
			groupName: 'Beta group',
			position: 1,
			name: 'A',
		})
		expect(memberGroupOrderKey({ id: 'x', name: 'X' }, groups)).toEqual({
			groupName: null,
			position: null,
			name: 'X',
		})
	})

	it('sorts by group name, then position, then unassigned items by name', () => {
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
					compareGroupOrder(
						memberGroupOrderKey(a, groups),
						memberGroupOrderKey(b, groups),
					),
				)
				.map(item => item.id),
		).toEqual(['m', 'z', 'a', 'x', 'y'])
	})
})
