import type { ColorScheme } from './colorScheme'

export interface AppState {
	readonly currentScheme: ColorScheme
	readonly currentColor: string
	readonly darkMode: boolean
	// Keyed by `HexCell.groupId`; a group with no entry is shown in the
	// default/accent color.
	readonly hexGroupColors: Readonly<Record<string, string>>
}
