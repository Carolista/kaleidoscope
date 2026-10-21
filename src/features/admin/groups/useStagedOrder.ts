import { useState } from 'react'

// Keeps a local member order until the owner saves it.
export default function useStagedOrder<T>(
	saved: readonly T[],
	idOf: (member: T) => string,
) {
	const [ids, setIds] = useState<readonly string[]>([])
	const ordered = [
		...ids.flatMap(id => saved.filter(member => idOf(member) === id)),
		...saved.filter(member => !ids.includes(idOf(member))),
	]
	const dirty = ordered.some(
		(member, index) => idOf(member) !== idOf(saved[index]),
	)
	return {
		ordered,
		dirty,
		setOrder: setIds,
		reset: () => setIds([]),
		drop: (removed: readonly string[]) =>
			setIds(previous => previous.filter(id => !removed.includes(id))),
	}
}
