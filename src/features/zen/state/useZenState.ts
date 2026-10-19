import { useContext } from 'react'
import { ZenStateContext } from './zenStateContext'
import type { ZenStateContextValue } from './zenStateContext'

export function useZenState(): ZenStateContextValue {
	const context = useContext(ZenStateContext)
	if (!context) {
		throw new Error('useZenState must be used within a ZenStateProvider')
	}
	return context
}
