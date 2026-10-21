import { createContext, useContext } from 'react'

export interface DraftScope {
	readonly userId: string
}

export const DraftScopeContext = createContext<DraftScope | null>(null)

export function useDraftScope() {
	return useContext(DraftScopeContext)
}
