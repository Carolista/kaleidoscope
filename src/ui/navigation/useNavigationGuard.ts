import { createContext, useContext, type ReactNode } from 'react'

export interface UnsavedWork {
	readonly dirty: boolean
	readonly pending: boolean
	// Called when the user confirms discarding this work.
	readonly discard?: () => void
}

export interface NavigationGuard {
	readonly register: (id: symbol, work: UnsavedWork) => () => void
	readonly isProtected: () => boolean
	readonly requestNavigation: (navigate: () => void) => void
	readonly dialog: ReactNode
}

export const NavigationGuardContext = createContext<NavigationGuard | null>(
	null,
)

export function useNavigationGuard() {
	const guard = useContext(NavigationGuardContext)
	if (!guard)
		throw new Error(
			'useNavigationGuard must be used within a NavigationGuardProvider',
		)
	return guard
}
