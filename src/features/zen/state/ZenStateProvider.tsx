import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { PlayerPalette } from '@/domain/palettes'
import type { GridShapeId, GridSize } from '@/domain/shapes'
import { createInitialHistoryState, historyReducer } from './historyReducer'
import { loadInitialZenState, savePersistedState } from './storageService'
import { usePlayerContent } from '@/ui/content'
import { PlayerThemeContext } from '@/ui/theme'
import { ZenStateContext } from './zenStateContext'

export function ZenStateProvider({
	children,
}: {
	readonly children: ReactNode
}) {
	const content = usePlayerContent()
	const [history, dispatch] = useReducer(historyReducer, content, value =>
		createInitialHistoryState(loadInitialZenState(value)),
	)
	const { present: state } = history

	useEffect(() => {
		savePersistedState(state)
	}, [state])

	const selectPalette = useCallback(
		(palette: PlayerPalette) =>
			dispatch({ type: 'SELECT_PALETTE', palette }),
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
			selectPalette,
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
			selectPalette,
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
			palette: state.currentPalette,
			toggleDarkMode,
		}),
		[state.darkMode, state.currentPalette, toggleDarkMode],
	)

	return (
		<ZenStateContext.Provider value={value}>
			<PlayerThemeContext.Provider value={theme}>
				{children}
			</PlayerThemeContext.Provider>
		</ZenStateContext.Provider>
	)
}
