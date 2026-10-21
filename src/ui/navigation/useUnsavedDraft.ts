import { useLayoutEffect, useRef } from 'react'
import { useNavigationGuard, type UnsavedWork } from './useNavigationGuard'

export default function useUnsavedDraft({
	dirty,
	pending,
	discard,
}: UnsavedWork) {
	const id = useRef(Symbol('unsaved work'))
	const discardRef = useRef(discard)
	const { register } = useNavigationGuard()
	useLayoutEffect(() => {
		discardRef.current = discard
	})
	useLayoutEffect(
		() =>
			register(id.current, {
				dirty,
				pending,
				discard: () => discardRef.current?.(),
			}),
		[dirty, pending, register],
	)
}
