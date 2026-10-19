import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { ColorScheme } from '@/domain/palettes'
import type { GridShapeId, GridSize } from '@/domain/shapes'
import { createInitialHistoryState, historyReducer } from './historyReducer'
import { loadInitialAppState, savePersistedState } from './storageService'
import { PlayerThemeContext } from '@/ui/theme'
import { AppStateContext } from './appStateContext'

export function AppStateProvider({
	children,
}: {
	readonly children: ReactNode
}) {
	const [history, dispatch] = useReducer(historyReducer, undefined, () =>
		createInitialHistoryState(loadInitialAppState()),
	)
	const { present: state } = history

	useEffect(() => {
		savePersistedState(state)
	}, [state])

	const selectScheme = useCallback(
		(scheme: ColorScheme) => dispatch({ type: 'SELECT_SCHEME', scheme }),
		[],
	)
	const selectColor = useCallback(
		(color: string) => dispatch({ type: 'SELECT_COLOR', color }),
		[],
	)
	const paintShapeGroup = useCallback(
		(groupId: string) => dispatch({ type: 'PAINT_SHAPE_GROUP', groupId }),
		[],
	)
	const toggleDarkMode = useCallback(
		() => dispatch({ type: 'TOGGLE_DARK_MODE' }),
		[],
	)
	const toggleEditableArea = useCallback(
		() => dispatch({ type: 'TOGGLE_EDITABLE_AREA' }),
		[],
	)
	const resetDesign = useCallback(
		() => dispatch({ type: 'RESET_DESIGN' }),
		[],
	)
	const randomizeDesign = useCallback(
		() => dispatch({ type: 'RANDOMIZE_DESIGN' }),
		[],
	)
	const selectGridShape = useCallback(
		(shape: GridShapeId, size?: GridSize) =>
			dispatch(
				size === undefined
					? { type: 'SELECT_GRID_SHAPE', shape }
					: { type: 'SELECT_GRID_SHAPE', shape, size },
			),
		[],
	)
	const selectGridSize = useCallback(
		(shape: GridShapeId, size: GridSize) =>
			dispatch({ type: 'SELECT_GRID_SIZE', shape, size }),
		[],
	)
	const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
	const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

	const value = useMemo(
		() => ({
			state,
			selectScheme,
			selectColor,
			paintShapeGroup,
			toggleDarkMode,
			toggleEditableArea,
			resetDesign,
			randomizeDesign,
			selectGridShape,
			selectGridSize,
			undo,
			redo,
			canUndo: history.past.length > 0,
			canRedo: history.future.length > 0,
		}),
		[
			state,
			selectScheme,
			selectColor,
			paintShapeGroup,
			toggleDarkMode,
			toggleEditableArea,
			resetDesign,
			randomizeDesign,
			selectGridShape,
			selectGridSize,
			undo,
			redo,
			history.past.length,
			history.future.length,
		],
	)

	const theme = useMemo(
		() => ({
			darkMode: state.darkMode,
			palette: state.currentScheme,
			toggleDarkMode,
		}),
		[state.darkMode, state.currentScheme, toggleDarkMode],
	)

	return (
		<AppStateContext.Provider value={value}>
			<PlayerThemeContext.Provider value={theme}>
				{children}
			</PlayerThemeContext.Provider>
		</AppStateContext.Provider>
	)
}
