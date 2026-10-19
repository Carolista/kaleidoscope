export interface SetOrderKey {
	readonly setName: string | null
	readonly position: number | null
	readonly name: string
}

interface OrderedSet {
	readonly row: { readonly name: string }
	readonly members: readonly { readonly id: string }[]
}

// Locates an item in its set, if any, for compareSetOrder.
export function memberSetOrderKey(
	item: { readonly id: string; readonly name: string },
	sets: readonly OrderedSet[],
): SetOrderKey {
	for (const set of sets) {
		const position = set.members.findIndex(member => member.id === item.id)
		if (position >= 0)
			return { setName: set.row.name, position, name: item.name }
	}
	return { setName: null, position: null, name: item.name }
}

// Items in sets sort by set name, then set position; items without a set follow by name.
export function compareSetOrder(a: SetOrderKey, b: SetOrderKey): number {
	if (a.setName === null || b.setName === null) {
		if (a.setName !== b.setName) return a.setName === null ? 1 : -1
		return a.name.localeCompare(b.name)
	}
	return (
		a.setName.localeCompare(b.setName) ||
		(a.position ?? 0) - (b.position ?? 0) ||
		a.name.localeCompare(b.name)
	)
}
