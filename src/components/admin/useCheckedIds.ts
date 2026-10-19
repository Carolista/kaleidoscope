import { useState } from 'react'

// Card selection limited to the ids currently shown.
export default function useCheckedIds(shownIds: readonly string[]) {
	const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
	const checked: ReadonlySet<string> = new Set(
		shownIds.filter(id => chosen.has(id)),
	)
	return {
		checked,
		ids: [...checked],
		toggle(id: string, value: boolean) {
			setChosen(previous => {
				const next = new Set(previous)
				if (value) next.add(id)
				else next.delete(id)
				return next
			})
		},
		setAll(value: boolean) {
			setChosen(new Set(value ? shownIds : []))
		},
		clear() {
			setChosen(new Set())
		},
	}
}
