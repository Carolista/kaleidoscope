import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { ColorScheme } from '../types/colorScheme'
import { appReducer } from './appReducer'
import { loadInitialAppState, savePersistedState } from './persistence'
import { AppStateContext } from './appStateContext'

export function AppStateProvider({
	children,
}: {
	readonly children: ReactNode
}) {
	const [state, dispatch] = useReducer(
		appReducer,
		undefined,
		loadInitialAppState,
	)

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
	const resetDesign = useCallback(
		() => dispatch({ type: 'RESET_DESIGN' }),
		[],
	)

	const value = useMemo(
		() => ({
			state,
			selectScheme,
			selectColor,
			paintHexGroup,
			toggleDarkMode,
			resetDesign,
		}),
		[
			state,
			selectScheme,
			selectColor,
			paintHexGroup,
			toggleDarkMode,
			resetDesign,
		],
	)

	return (
		<AppStateContext.Provider value={value}>
			{children}
		</AppStateContext.Provider>
	)
}
