import type { ColorScheme } from './colorScheme'

export interface AppState {
	readonly currentScheme: ColorScheme
	readonly currentColor: string
	readonly darkMode: boolean
	// Whether the editable wedge is permanently highlighted (dimming the
	// rest of the grid), independent of hover. Only ever toggled from the
	// touch-only EditableAreaToggle; ignored on non-touch devices, which
	// rely on hover instead.
	readonly showEditableArea: boolean
	// Keyed by `HexCell.groupId`; a group with no entry is shown in the
	// default/accent color.
	readonly hexGroupColors: Readonly<Record<string, string>>
}
