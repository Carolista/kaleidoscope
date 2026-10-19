import type { ColorScheme } from '@/domain/palettes'
import type { GridShapeId, GridSize } from '@/domain/shapes'

export type BoardId = `${GridShapeId}:${GridSize}`
export type PaintMap = Readonly<Record<string, string>>
export type SavedBoards = Readonly<Partial<Record<BoardId, PaintMap>>>

export interface AppState {
	readonly currentScheme: ColorScheme
	readonly currentColor: string
	readonly darkMode: boolean
	// Whether the editable wedge is permanently highlighted (dimming the
	// rest of the grid), independent of hover. Only ever toggled from the
	// touch-only EditableAreaToggle; ignored on non-touch devices, which
	// rely on hover instead.
	readonly showEditableArea: boolean
	// Which grid shape is currently selected (hexagon, triangle, ...).
	readonly gridShape: GridShapeId
	// Size choices are remembered independently for each shape.
	readonly gridSizes: Readonly<Record<GridShapeId, GridSize>>
	// Active board paint; absent groups display accent.
	readonly shapeGroupColors: PaintMap
	// Inactive boards only. Switching stashes the outgoing board and removes
	// the incoming board here, so there is never a second copy of active paint.
	readonly savedBoards: SavedBoards
}
