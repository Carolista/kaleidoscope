import { useCallback, useLayoutEffect, useRef } from 'react'

export const SWIPE_MS = 700
const SWIPE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'

interface Snapshot {
	readonly clone: HTMLElement
	readonly left: number
	readonly top: number
	readonly width: number
	readonly height: number
	readonly transform: string
}

function captureSnapshot(node: HTMLElement): Snapshot {
	// If the puzzle is replaced mid-entrance, the copy starts where it is now.
	const { transform } = getComputedStyle(node)
	const clone = node.cloneNode(true) as HTMLElement
	clone.setAttribute('aria-hidden', 'true')
	clone.inert = true
	clone.removeAttribute('id')
	clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'))
	return {
		clone,
		left: node.offsetLeft,
		top: node.offsetTop,
		width: node.offsetWidth,
		height: node.offsetHeight,
		transform,
	}
}

function prefersReducedMotion() {
	return (
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	)
}

// Flies a newly shown puzzle in from the right while the one it replaces
// (if any) flies out to the left. `contentRef` goes on the part that changes
// per puzzle (target, tray, board) so controls around it stay put, and
// `stageRef` on a positioned ancestor that outlives each puzzle.
export function usePuzzleSwipe(puzzleKey: string | null) {
	const stageRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLDivElement | null>(null)
	const snapshotRef = useRef<Snapshot | null>(null)
	const previousKeyRef = useRef<string | null>(null)

	// React 19 ref cleanup runs while the outgoing content is still in the
	// DOM, the only moment its painted state can be copied for the exit.
	const contentCallbackRef = useCallback((node: HTMLDivElement | null) => {
		contentRef.current = node
		if (!node) return
		return () => {
			snapshotRef.current = captureSnapshot(node)
			contentRef.current = null
		}
	}, [])

	useLayoutEffect(() => {
		const stage = stageRef.current
		const content = contentRef.current
		const snapshot = snapshotRef.current
		snapshotRef.current = null
		const previousKey = previousKeyRef.current
		previousKeyRef.current = puzzleKey

		if (
			!stage ||
			!content ||
			puzzleKey === null ||
			previousKey === puzzleKey ||
			typeof content.animate !== 'function' ||
			prefersReducedMotion()
		) {
			return
		}

		const distance = window.innerWidth
		const options = {
			duration: SWIPE_MS,
			easing: SWIPE_EASING,
		}

		let clone: HTMLElement | null = null
		let exit: Animation | null = null
		if (snapshot && previousKey !== null) {
			clone = snapshot.clone
			Object.assign(clone.style, {
				position: 'absolute',
				left: `${snapshot.left}px`,
				top: `${snapshot.top}px`,
				width: `${snapshot.width}px`,
				height: `${snapshot.height}px`,
				pointerEvents: 'none',
			})
			stage.appendChild(clone)
			const leaving = clone
			exit = leaving.animate(
				[
					{
						transform:
							snapshot.transform === 'none'
								? 'translateX(0)'
								: snapshot.transform,
					},
					{ transform: `translateX(${-distance}px)` },
				],
				{ ...options, fill: 'forwards' },
			)
			exit.onfinish = () => leaving.remove()
		}

		// Not interactive until it has arrived.
		content.style.pointerEvents = 'none'
		const enter = content.animate(
			[{ transform: `translateX(${distance}px)` }, { transform: 'none' }],
			{ ...options, fill: 'backwards' },
		)
		enter.onfinish = () => {
			content.style.pointerEvents = ''
		}

		return () => {
			exit?.cancel()
			enter.cancel()
			clone?.remove()
			content.style.pointerEvents = ''
		}
	}, [puzzleKey])

	return { stageRef, contentRef: contentCallbackRef }
}
