import { createContext } from 'react'
import type { AppState } from '../types/appState'
import type { ColorScheme } from '../types/colorScheme'
import type { GridShapeId } from '../types/gridShape'

export interface AppStateContextValue {
	readonly state: AppState
	readonly selectScheme: (scheme: ColorScheme) => void
	readonly selectColor: (color: string) => void
	readonly paintHexGroup: (groupId: string) => void
	readonly toggleDarkMode: () => void
	readonly toggleEditableArea: () => void
	readonly resetDesign: () => void
	readonly randomizeDesign: () => void
	readonly selectGridShape: (shape: GridShapeId) => void
	readonly undo: () => void
	readonly redo: () => void
	readonly canUndo: boolean
	readonly canRedo: boolean
}

export const AppStateContext = createContext<AppStateContextValue | null>(null)
