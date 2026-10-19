import { createContext } from 'react'
import type { ZenState } from './zenState'
import type { Palette } from '@/domain/palettes'
import type { GridShapeId, GridSize } from '@/domain/shapes'

export interface ZenStateContextValue {
	readonly state: ZenState
	readonly selectPalette: (palette: Palette) => void
	readonly selectColor: (color: string) => void
	readonly paintShapeGroup: (groupId: string) => void
	readonly toggleDarkMode: () => void
	readonly toggleEditableArea: () => void
	readonly resetDesign: () => void
	readonly randomizeDesign: () => void
	readonly selectGridShape: (shape: GridShapeId, size?: GridSize) => void
	readonly selectGridSize: (shape: GridShapeId, size: GridSize) => void
	readonly undo: () => void
	readonly redo: () => void
	readonly canUndo: boolean
	readonly canRedo: boolean
}

export const ZenStateContext = createContext<ZenStateContextValue | null>(null)
