import {
	useCallback,
	useContext,
	useEffect,
	useRef,
	type ReactNode,
} from 'react'
import { ConfirmDialog } from '@/ui/components'
import { useModalState } from '@/ui/hooks'
import {
	NavigationGuardContext as Context,
	useNavigationGuard,
	type UnsavedWork,
} from './useNavigationGuard'

export function NavigationGuardProvider({
	children,
}: {
	readonly children: ReactNode
}) {
	const work = useRef(new Map<symbol, UnsavedWork>())
	const intent = useRef<(() => void) | null>(null)
	const deciding = useRef(false)
	const [kind, change, modal] = useModalState<'discard' | 'pending'>()
	const register = useCallback((id: symbol, value: UnsavedWork) => {
		work.current.set(id, value)
		return () => {
			work.current.delete(id)
		}
	}, [])
	const isProtected = useCallback(
		() =>
			deciding.current ||
			[...work.current.values()].some(
				value => value.dirty || value.pending,
			),
		[],
	)
	const hasPending = useCallback(
		() => [...work.current.values()].some(value => value.pending),
		[],
	)
	const requestNavigation = useCallback(
		(navigate: () => void) => {
			if (deciding.current) return
			if (!isProtected()) {
				navigate()
				return
			}
			deciding.current = true
			intent.current = navigate
			change(hasPending() ? 'pending' : 'discard')
		},
		[change, isProtected, hasPending],
	)

	function finish(discard: boolean) {
		if (!modal.open) return
		if (discard && hasPending()) {
			change('pending')
			return
		}
		const navigate = discard ? intent.current : null
		intent.current = null
		change(null, () => {
			deciding.current = false
			if (!navigate) return
			if (hasPending()) requestNavigation(navigate)
			else navigate()
		})
	}

	useEffect(() => {
		function beforeUnload(event: BeforeUnloadEvent) {
			if (!isProtected()) return
			event.preventDefault()
			event.returnValue = ''
		}
		window.addEventListener('beforeunload', beforeUnload)
		return () => window.removeEventListener('beforeunload', beforeUnload)
	}, [isProtected])

	const dialog = kind && (
		<ConfirmDialog
			{...modal}
			title={
				kind === 'pending'
					? 'Operation in progress'
					: 'Discard unsaved changes?'
			}
			message={
				kind === 'pending'
					? 'Wait for the current admin operation to finish before leaving. Leaving would not cancel a request already sent to the server.'
					: 'Your unsaved admin changes will be lost. Keep editing or discard them and continue?'
			}
			confirmLabel={kind === 'pending' ? 'Stay here' : 'Discard changes'}
			cancelLabel={kind === 'pending' ? 'Close' : 'Keep editing'}
			closeLabel="Close navigation confirmation"
			destructive={kind === 'discard'}
			onConfirm={() => finish(kind === 'discard')}
			onCancel={() => finish(false)}
		/>
	)
	return (
		<Context.Provider
			value={{ register, isProtected, requestNavigation, dialog }}
		>
			{children}
		</Context.Provider>
	)
}

export function NavigationGuardBoundary({
	children,
}: {
	readonly children: ReactNode
}) {
	const context = useContext(Context)
	return context ? (
		children
	) : (
		<NavigationGuardProvider>{children}</NavigationGuardProvider>
	)
}

export function NavigationGuardDialog() {
	return useNavigationGuard().dialog
}
