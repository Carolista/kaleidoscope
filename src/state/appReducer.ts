import type { AppState } from '../types/appState'
import type { ColorScheme } from '../types/colorScheme'
import { colorSchemes } from '../data/colorSchemes'
import { getThemeColors } from './theme'

export type AppAction =
  | { readonly type: 'SELECT_SCHEME'; readonly scheme: ColorScheme }
  | { readonly type: 'SELECT_COLOR'; readonly color: string }
  | { readonly type: 'PAINT_HEX_GROUP'; readonly groupId: string }
  | { readonly type: 'TOGGLE_DARK_MODE' }
  | { readonly type: 'RESET_DESIGN' }

/** Picks a random scheme, matching the original app's randomized default on page load. */
export function pickRandomScheme(): ColorScheme {
  return colorSchemes[Math.floor(Math.random() * colorSchemes.length)]
}

export function createInitialAppState(): AppState {
  const currentScheme = pickRandomScheme()
  return {
    currentScheme,
    currentColor: currentScheme.colors[0],
    darkMode: false,
    hexGroupColors: {},
  }
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SELECT_SCHEME':
      return {
        ...state,
        currentScheme: action.scheme,
        currentColor: action.scheme.colors[0],
      }

    case 'SELECT_COLOR':
      return { ...state, currentColor: action.color }

    case 'PAINT_HEX_GROUP': {
      const { accent } = getThemeColors(state.darkMode)
      const existing = state.hexGroupColors[action.groupId] ?? accent
      const isTogglingOff = existing === state.currentColor
      return {
        ...state,
        hexGroupColors: {
          ...state.hexGroupColors,
          [action.groupId]: isTogglingOff ? accent : state.currentColor,
        },
      }
    }

    case 'TOGGLE_DARK_MODE': {
      const darkMode = !state.darkMode
      const oldTheme = getThemeColors(state.darkMode)
      const newTheme = getThemeColors(darkMode)
      // Flip any hexagons that were painted exactly the old base/accent color,
      // so they track the new theme instead of freezing at a stale color.
      const hexGroupColors = Object.fromEntries(
        Object.entries(state.hexGroupColors).map(([groupId, color]) => {
          if (color === oldTheme.base) return [groupId, newTheme.base]
          if (color === oldTheme.accent) return [groupId, newTheme.accent]
          return [groupId, color]
        }),
      )
      return { ...state, darkMode, hexGroupColors }
    }

    case 'RESET_DESIGN':
      return { ...state, hexGroupColors: {} }

    default:
      return state
  }
}
