import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { ColorScheme } from '../types/colorScheme'
import { createInitialHistoryState, historyReducer } from './historyReducer'
import {
	loadInitialAppState,
	savePersistedState,
} from '../services/storageService'
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
	const paintHexGroup = useCallback(
		(groupId: string) => dispatch({ type: 'PAINT_HEX_GROUP', groupId }),
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
	const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
	const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

	const value = useMemo(
		() => ({
			state,
			selectScheme,
			selectColor,
			paintHexGroup,
			toggleDarkMode,
			toggleEditableArea,
			resetDesign,
			randomizeDesign,
			undo,
			redo,
			canUndo: history.past.length > 0,
			canRedo: history.future.length > 0,
		}),
		[
			state,
			selectScheme,
			selectColor,
			paintHexGroup,
			toggleDarkMode,
			toggleEditableArea,
			resetDesign,
			randomizeDesign,
			undo,
			redo,
			history.past.length,
			history.future.length,
		],
	)

	return (
		<AppStateContext.Provider value={value}>
			{children}
		</AppStateContext.Provider>
	)
}
