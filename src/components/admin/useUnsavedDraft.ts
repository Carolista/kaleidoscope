import { useEffect } from 'react'

export function confirmDiscardDraft(): boolean {
	return window.confirm('Discard unsaved admin changes?')
}

export default function useUnsavedDraft(
	dirty: boolean,
	onDirtyChange?: (dirty: boolean) => void,
) {
	useEffect(() => {
		onDirtyChange?.(dirty)
		return () => onDirtyChange?.(false)
	}, [dirty, onDirtyChange])

	useEffect(() => {
		if (!dirty) return
		function beforeUnload(event: BeforeUnloadEvent) {
			event.preventDefault()
			event.returnValue = ''
		}
		window.addEventListener('beforeunload', beforeUnload)
		return () => {
			window.removeEventListener('beforeunload', beforeUnload)
		}
	}, [dirty])
}
