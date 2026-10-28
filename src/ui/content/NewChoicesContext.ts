import { createContext, useContext } from 'react'

// Whether Zen's pickers offer anything the player has not looked at yet.
export interface NewChoices {
	readonly newPalettes: boolean
	readonly newShapes: boolean
	// The palettes behind `newPalettes`, so a picker can mark them. Empty once seen.
	readonly newPaletteIds: ReadonlySet<string>
	// Called when the picker is opened: everything it offers now counts as seen.
	readonly markPalettesSeen: () => void
	readonly markShapesSeen: () => void
}

export const NewChoicesContext = createContext<NewChoices | null>(null)

export function useNewChoices(): NewChoices {
	const choices = useContext(NewChoicesContext)
	if (!choices)
		throw new Error(
			'useNewChoices must be used within a PlayerProgressProvider',
		)
	return choices
}
