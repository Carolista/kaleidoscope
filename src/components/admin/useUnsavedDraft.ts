import { useLayoutEffect, useRef } from 'react'
import { useNavigationGuard, type UnsavedWork } from './useNavigationGuard'

export default function useUnsavedDraft({ dirty, pending }: UnsavedWork) {
	const id = useRef(Symbol('admin work'))
	const { register } = useNavigationGuard()
	useLayoutEffect(
		() => register(id.current, { dirty, pending }),
		[dirty, pending, register],
	)
}
