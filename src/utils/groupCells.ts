// Both groups and their members retain first-seen order.
export function groupCells<Cell extends { readonly groupId: string }>(
	cells: readonly Cell[],
): Map<string, Cell[]> {
	const groups = new Map<string, Cell[]>()
	for (const cell of cells) {
		const list = groups.get(cell.groupId)
		if (list) {
			list.push(cell)
		} else {
			groups.set(cell.groupId, [cell])
		}
	}
	return groups
}
