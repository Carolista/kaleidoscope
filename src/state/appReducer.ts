import { colorSchemes } from '@/data/colorSchemes'
import type { AppState, BoardId, PaintMap } from '@/types/appState'
import type { ColorScheme } from '@/types/colorScheme'
import type { GridShapeId } from '@/types/gridShape'
import type { GridSize } from '@/types/gridSize'
import { availableGridSizes, defaultGridSizes } from '@/data/gridSizes'
import { getGroupIdsForShape } from '@/utils/gridShapeRegistry'
import { generateRandomShapeGroupColors } from '@/utils/randomDesign'
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
		savedBoards: {},
	}
}

function switchBoard(
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
	if (shape !== state.gridShape) {
		return { ...state, gridSizes }
	}
	return activateBoard(state, shape, size)
}

function activateBoard(
	state: AppState,
	shape: GridShapeId,
	size: GridSize,
): AppState {
	const outgoing: BoardId = `${state.gridShape}:${state.gridSizes[state.gridShape]}`
	const incoming: BoardId = `${shape}:${size}`
	if (outgoing === incoming) return state
	const savedBoards = {
		...state.savedBoards,
		[outgoing]: state.shapeGroupColors,
	}
	const shapeGroupColors = savedBoards[incoming] ?? {}
	delete savedBoards[incoming]
	return {
		...state,
		gridShape: shape,
		gridSizes: { ...state.gridSizes, [shape]: size },
		shapeGroupColors,
		savedBoards,
	}
}

function mapPaint(
	state: AppState,
	transform: (color: string) => string,
): Pick<AppState, 'shapeGroupColors' | 'savedBoards'> {
	const remap = (paint: PaintMap) =>
		Object.fromEntries(
			Object.entries(paint).map(([id, color]) => [id, transform(color)]),
		)
	return {
		shapeGroupColors: remap(state.shapeGroupColors),
		savedBoards: Object.fromEntries(
			Object.entries(state.savedBoards).map(([id, paint]) => [
				id,
				remap(paint),
			]),
		),
	}
}

export function appReducer(state: AppState, action: AppAction): AppState {
	switch (action.type) {
		case 'SELECT_SCHEME': {
			const oldColors = state.currentScheme.colors
			const newColors = action.scheme.colors
			// Remap any tile painted with one of the old scheme's colors to the
			// color at the same position in the new scheme, so the design's
			// pattern carries over. Tiles painted base/accent are left as-is.
			const paint = mapPaint(state, color => {
				const colorIndex = oldColors.indexOf(color)
				return colorIndex === -1 ? color : newColors[colorIndex]
			})
			return {
				...state,
				currentScheme: action.scheme,
				currentColor: newColors[0],
				...paint,
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
			const paint = mapPaint(state, color => {
				if (color === oldTheme.base) return newTheme.base
				if (color === oldTheme.accent) return newTheme.accent
				return color
			})
			return { ...state, darkMode, ...paint }
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
			return switchBoard(state, action.shape, action.size)

		case 'SELECT_GRID_SHAPE': {
			if (
				action.size !== undefined &&
				!availableGridSizes[action.shape].includes(action.size)
			) {
				return state
			}
			if (action.shape === state.gridShape) {
				if (action.size === undefined) return state
				return switchBoard(state, action.shape, action.size)
			}
			return activateBoard(
				state,
				action.shape,
				action.size ?? state.gridSizes[action.shape],
			)
		}

		default:
			return state
	}
}
