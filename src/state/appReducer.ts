import { colorSchemes } from '../data/colorSchemes'
import type { AppState } from '../types/appState'
import type { ColorScheme } from '../types/colorScheme'
import type { GridShapeId } from '../types/gridShape'
import type { GridSize } from '../types/gridSize'
import { availableGridSizes, defaultGridSizes } from '../data/gridSizes'
import { getGroupIdsForShape } from '../utils/gridShapeRegistry'
import { generateRandomShapeGroupColors } from '../utils/randomDesign'
import { getThemeColors } from './theme'

export type AppAction =
	| { readonly type: 'SELECT_SCHEME'; readonly scheme: ColorScheme }
	| { readonly type: 'SELECT_COLOR'; readonly color: string }
	| { readonly type: 'PAINT_SHAPE_GROUP'; readonly groupId: string }
	| { readonly type: 'TOGGLE_DARK_MODE' }
	| { readonly type: 'TOGGLE_EDITABLE_AREA' }
	| { readonly type: 'RESET_DESIGN' }
	| { readonly type: 'RANDOMIZE_DESIGN' }
	| {
			readonly type: 'SELECT_GRID_SHAPE'
			readonly shape: GridShapeId
			readonly size?: GridSize
	  }
	| {
			readonly type: 'SELECT_GRID_SIZE'
			readonly shape: GridShapeId
			readonly size: GridSize
	  }

export function createInitialAppState(): AppState {
	const currentScheme = colorSchemes[0]
	return {
		currentScheme,
		currentColor: currentScheme.colors[0],
		darkMode: true,
		showEditableArea: true,
		gridShape: 'hexagon',
		gridSizes: { ...defaultGridSizes },
		shapeGroupColors: {},
	}
}

function withGridSize(
	state: AppState,
	shape: GridShapeId,
	size: GridSize,
): AppState {
	if (
		!availableGridSizes[shape].includes(size) ||
		state.gridSizes[shape] === size
	) {
		return state
	}
	const gridSizes = { ...state.gridSizes, [shape]: size }
	let shapeGroupColors = state.shapeGroupColors
	if (shape === state.gridShape && shape === 'hexagon') {
		const groupIds = new Set(getGroupIdsForShape('hexagon', size))
		shapeGroupColors = Object.fromEntries(
			Object.entries(shapeGroupColors).filter(([groupId]) =>
				groupIds.has(groupId),
			),
		)
	}
	return { ...state, gridSizes, shapeGroupColors }
}

export function appReducer(state: AppState, action: AppAction): AppState {
	switch (action.type) {
		case 'SELECT_SCHEME': {
			const oldColors = state.currentScheme.colors
			const newColors = action.scheme.colors
			// Remap any tile painted with one of the old scheme's colors to the
			// color at the same position in the new scheme, so the design's
			// pattern carries over. Tiles painted base/accent are left as-is.
			const shapeGroupColors = Object.fromEntries(
				Object.entries(state.shapeGroupColors).map(
					([groupId, color]) => {
						const colorIndex = oldColors.indexOf(color)
						if (colorIndex === -1) return [groupId, color]
						return [groupId, newColors[colorIndex]]
					},
				),
			)
			return {
				...state,
				currentScheme: action.scheme,
				currentColor: newColors[0],
				shapeGroupColors,
			}
		}

		case 'SELECT_COLOR':
			if (action.color === state.currentColor) return state
			return { ...state, currentColor: action.color }

		case 'PAINT_SHAPE_GROUP': {
			const { accent } = getThemeColors(state.darkMode)
			const existing = state.shapeGroupColors[action.groupId] ?? accent
			const isTogglingOff = existing === state.currentColor
			const color = isTogglingOff ? accent : state.currentColor
			if (color === existing) return state
			return {
				...state,
				shapeGroupColors: {
					...state.shapeGroupColors,
					[action.groupId]: color,
				},
			}
		}

		case 'TOGGLE_DARK_MODE': {
			const darkMode = !state.darkMode
			const oldTheme = getThemeColors(state.darkMode)
			const newTheme = getThemeColors(darkMode)
			// Flip any hexagons that were painted exactly the old base/accent color,
			// so they track the new theme instead of freezing at a stale color.
			const shapeGroupColors = Object.fromEntries(
				Object.entries(state.shapeGroupColors).map(
					([groupId, color]) => {
						if (color === oldTheme.base)
							return [groupId, newTheme.base]
						if (color === oldTheme.accent)
							return [groupId, newTheme.accent]
						return [groupId, color]
					},
				),
			)
			return { ...state, darkMode, shapeGroupColors }
		}

		case 'TOGGLE_EDITABLE_AREA':
			return { ...state, showEditableArea: !state.showEditableArea }

		case 'RESET_DESIGN':
			if (Object.keys(state.shapeGroupColors).length === 0) return state
			return { ...state, shapeGroupColors: {} }

		case 'RANDOMIZE_DESIGN': {
			const { base } = getThemeColors(state.darkMode)
			const shapeGroupColors = generateRandomShapeGroupColors(
				getGroupIdsForShape(
					state.gridShape,
					state.gridSizes[state.gridShape],
				),
				state.currentScheme,
				base,
			)
			return { ...state, shapeGroupColors }
		}

		case 'SELECT_GRID_SIZE':
			return withGridSize(state, action.shape, action.size)

		case 'SELECT_GRID_SHAPE': {
			if (
				action.size !== undefined &&
				!availableGridSizes[action.shape].includes(action.size)
			) {
				return state
			}
			if (action.shape === state.gridShape) {
				if (action.size === undefined) return state
				return withGridSize(state, action.shape, action.size)
			}
			const nextState = {
				...state,
				gridShape: action.shape,
				shapeGroupColors: {},
			}
			return action.size === undefined
				? nextState
				: withGridSize(nextState, action.shape, action.size)
		}

		default:
			return state
	}
}
