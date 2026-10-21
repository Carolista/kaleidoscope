export interface GroupOrderKey {
	readonly groupName: string | null
	readonly position: number | null
	readonly name: string
}

interface OrderedSet {
	readonly row: { readonly name: string }
	readonly members: readonly { readonly id: string }[]
}

// Locates an item in its set, if any, for compareGroupOrder.
export function memberGroupOrderKey(
	item: { readonly id: string; readonly name: string },
	sets: readonly OrderedSet[],
): GroupOrderKey {
	for (const set of sets) {
		const position = set.members.findIndex(member => member.id === item.id)
		if (position >= 0)
			return { groupName: set.row.name, position, name: item.name }
	}
	return { groupName: null, position: null, name: item.name }
}

// Items in sets sort by set name, then set position; items without a set follow by name.
export function compareGroupOrder(a: GroupOrderKey, b: GroupOrderKey): number {
	if (a.groupName === null || b.groupName === null) {
		if (a.groupName !== b.groupName) return a.groupName === null ? 1 : -1
		return a.name.localeCompare(b.name)
	}
	return (
		a.groupName.localeCompare(b.groupName) ||
		(a.position ?? 0) - (b.position ?? 0) ||
		a.name.localeCompare(b.name)
	)
}
