import { useContext } from 'react'
import { AppStateContext } from './appStateContext'
import type { AppStateContextValue } from './appStateContext'

/** Access the kaleidoscope's app state and actions. Must be used within an `<AppStateProvider>`. */
export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider')
  }
  return context
}
