import type { ColorScheme } from './colorScheme'

/**
 * Shape of the application state (implemented as a reducer in a later
 * step). Captured here now so the data-modeling pieces built in this step
 * (color schemes, hex grid) have a clear shape to slot into.
 */
export interface AppState {
  readonly currentScheme: ColorScheme
  readonly currentColor: string
  readonly darkMode: boolean
  /**
   * Current paint color for each hex mirror-group, keyed by `HexCell.groupId`.
   * A group with no entry is shown in the default/accent color.
   */
  readonly hexGroupColors: Readonly<Record<string, string>>
}
