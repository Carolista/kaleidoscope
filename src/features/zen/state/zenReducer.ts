import { getThemeColors } from '@/domain/palettes'
import type { ZenState, BoardId, PaintMap } from './zenState'
import type { PlayerPalette } from '@/domain/palettes'
import type { GridShapeId, GridSize } from '@/domain/shapes'
import {
	availableGridSizes,
	defaultGridSizes,
	getGroupIdsForShape,
} from '@/domain/shapes'
import { generateRandomShapeGroupColors } from './randomDesign'

export type ZenAction =
	| { readonly type: 'SELECT_PALETTE'; readonly palette: PlayerPalette }
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

export function createInitialZenState(
	palettes: readonly PlayerPalette[],
	gridShape: GridShapeId = 'hexagon',
): ZenState {
	const currentPalette = palettes[0]
	return {
		currentPalette,
		currentColor: currentPalette.colors[0],
		darkMode: true,
		showEditableArea: true,
		gridShape,
		gridSizes: { ...defaultGridSizes },
		shapeGroupColors: {},
		savedBoards: {},
	}
}

function switchBoard(
	state: ZenState,
	shape: GridShapeId,
	size: GridSize,
): ZenState {
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
	state: ZenState,
	shape: GridShapeId,
	size: GridSize,
): ZenState {
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
	state: ZenState,
	transform: (color: string) => string,
): Pick<ZenState, 'shapeGroupColors' | 'savedBoards'> {
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

export function zenReducer(state: ZenState, action: ZenAction): ZenState {
	switch (action.type) {
		case 'SELECT_PALETTE': {
			const oldColors = state.currentPalette.colors
			const newColors = action.palette.colors
			// Remap any tile painted with one of the old palette's colors to the
			// color at the same position in the new palette, so the design's
			// pattern carries over. Tiles painted base/accent are left as-is.
			const paint = mapPaint(state, color => {
				const colorIndex = oldColors.indexOf(color)
				return colorIndex === -1 ? color : newColors[colorIndex]
			})
			return {
				...state,
				currentPalette: action.palette,
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
				state.currentPalette,
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
