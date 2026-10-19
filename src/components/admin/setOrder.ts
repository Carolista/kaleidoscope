export interface SetOrderKey {
	readonly setName: string | null
	readonly position: number | null
	readonly name: string
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
