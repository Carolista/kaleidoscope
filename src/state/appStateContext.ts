import { createContext } from 'react'
import type { AppState } from '../types/appState'
import type { ColorScheme } from '../types/colorScheme'

export interface AppStateContextValue {
  readonly state: AppState
  readonly selectScheme: (scheme: ColorScheme) => void
  readonly selectColor: (color: string) => void
  readonly paintHexGroup: (groupId: string) => void
  readonly toggleDarkMode: () => void
  readonly resetDesign: () => void
}

export const AppStateContext = createContext<AppStateContextValue | null>(null)
