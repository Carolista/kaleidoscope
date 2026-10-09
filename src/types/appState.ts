import type { ColorScheme } from './colorScheme'
import type { GridShapeId } from './gridShape'

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
	// Switching shapes resets `shapeGroupColors`, since a group id from one
	// shape's symmetry grouping has no meaning for another's.
	readonly gridShape: GridShapeId
	// Keyed by the current shape's cell `groupId`; a group with no entry
	// is shown in the default/accent color. Originally named
	// `hexGroupColors` from when hexagon was the only shape; renamed once the
	// app grew multiple shapes, since the field itself has always just
	// been a generic map keyed by group id.
	readonly shapeGroupColors: Readonly<Record<string, string>>
}
