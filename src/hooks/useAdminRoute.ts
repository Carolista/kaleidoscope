import { useEffect, useState } from 'react'
import { useNavigationGuard } from '@/components/admin/useNavigationGuard'

const indexKey = 'kaleidoscopeRouteIndex'
function historyIndex(): number | null {
	const state: unknown = window.history.state
	if (state && typeof state === 'object' && indexKey in state) {
		const index = state[indexKey]
		if (typeof index === 'number' && Number.isSafeInteger(index))
			return index
	}
	return null
}
function stamp(index: number) {
	window.history.replaceState(
		{ ...window.history.state, [indexKey]: index },
		'',
	)
}
function isAdmin(url: string) {
	return new URL(url).hash === '#/admin'
}

export default function useAdminRoute() {
	const [admin, setAdmin] = useState(() => isAdmin(window.location.href))
	const { isProtected, requestNavigation } = useNavigationGuard()
	useEffect(() => {
		let accepted = {
			url: window.location.href,
			index: historyIndex() ?? 0,
			state: window.history.state,
		}
		stamp(accepted.index)
		accepted.state = window.history.state
		let approved: string | null = null
		let afterRestore: (() => void) | null = null
		let restoringURL: string | null = null

		function commit(url: string) {
			const index = historyIndex() ?? accepted.index + 1
			stamp(index)
			accepted = { url, index, state: window.history.state }
			setAdmin(isAdmin(url))
		}
		function update() {
			const destination = window.location.href
			if (destination === accepted.url) {
				restoringURL = null
				const resume = afterRestore
				afterRestore = null
				resume?.()
				return
			}
			if (destination === approved) {
				approved = null
				commit(destination)
				return
			}
			if (
				!isAdmin(accepted.url) ||
				isAdmin(destination) ||
				!isProtected()
			) {
				commit(destination)
				return
			}
			const index = historyIndex()
			if (index !== null && index !== accepted.index) {
				const destinationIndex = index
				if (restoringURL === destination) return
				restoringURL = destination
				// Traverse back to the accepted entry instead of overwriting history.
				window.history.go(accepted.index - index)
				requestNavigation(() => {
					function resume() {
						approved = destination
						window.history.go(destinationIndex - accepted.index)
					}
					if (window.location.href === accepted.url) resume()
					else afterRestore = resume
				})
			} else {
				// Untracked hashes (including external scripts) have no traversal index.
				const destinationState = window.history.state
				window.history.replaceState(accepted.state, '', accepted.url)
				requestNavigation(() => {
					window.history.replaceState(
						destinationState,
						'',
						destination,
					)
					commit(destination)
				})
			}
		}
		function click(event: MouseEvent) {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			)
				return
			const anchor =
				event.target instanceof Element
					? event.target.closest('a')
					: null
			if (!anchor || anchor.target || anchor.hasAttribute('download'))
				return
			const destination = new URL(anchor.href)
			const current = new URL(accepted.url)
			if (
				destination.origin !== current.origin ||
				destination.pathname !== current.pathname ||
				destination.search !== current.search ||
				!isAdmin(accepted.url) ||
				isAdmin(destination.href) ||
				!isProtected()
			)
				return
			event.preventDefault()
			requestNavigation(() => {
				window.history.pushState(
					{ [indexKey]: accepted.index + 1 },
					'',
					destination,
				)
				commit(destination.href)
			})
		}
		window.addEventListener('popstate', update)
		window.addEventListener('hashchange', update)
		document.addEventListener('click', click)
		return () => {
			window.removeEventListener('popstate', update)
			window.removeEventListener('hashchange', update)
			document.removeEventListener('click', click)
		}
	}, [isProtected, requestNavigation])
	return admin
}
