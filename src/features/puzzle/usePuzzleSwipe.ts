import { useCallback, useLayoutEffect, useRef } from 'react'

export const SWIPE_MS = 700
const SWIPE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'

interface RunningAnimation {
	// The animated element's place among the copied node and its descendants.
	readonly index: number
	readonly name: string
	readonly time: number
}

interface Snapshot {
	readonly clone: HTMLElement
	readonly left: number
	readonly top: number
	readonly width: number
	readonly height: number
	readonly transform: string
	readonly animations: readonly RunningAnimation[]
}

// Every element in a node and its descendants, in document order, which is the
// same for a node and its clone.
function elementsOf(node: HTMLElement): Element[] {
	return [node, ...node.querySelectorAll('*')]
}

// The CSS animations playing or holding their end state in a node, with how far
// along each is. A clone starts every animation again from zero, which would
// replay finished ones (like the "Congrats!" fade) in the copy that flies away.
function recordAnimations(node: HTMLElement): RunningAnimation[] {
	if (typeof document.getAnimations !== 'function') return []
	const elements = elementsOf(node)
	return document.getAnimations().flatMap(animation => {
		const target = (animation.effect as KeyframeEffect | null)?.target
		const index = target ? elements.indexOf(target) : -1
		const name = (animation as Partial<CSSAnimation>).animationName
		const time = Number(animation.currentTime)
		return index < 0 || !name || Number.isNaN(time)
			? []
			: [{ index, name, time }]
	})
}

// Puts the clone's animations where the original's were when it was copied.
function resumeAnimations(
	clone: HTMLElement,
	recorded: readonly RunningAnimation[],
) {
	if (!recorded.length || typeof document.getAnimations !== 'function') return
	const elements = elementsOf(clone)
	for (const animation of document.getAnimations()) {
		const target = (animation.effect as KeyframeEffect | null)?.target
		const index = target ? elements.indexOf(target) : -1
		const name = (animation as Partial<CSSAnimation>).animationName
		const match = recorded.find(
			item => item.index === index && item.name === name,
		)
		if (match) animation.currentTime = match.time
	}
}

function captureSnapshot(node: HTMLElement): Snapshot {
	// If the puzzle is replaced mid-entrance, the copy starts where it is now.
	const { transform } = getComputedStyle(node)
	const animations = recordAnimations(node)
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
		animations,
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
			resumeAnimations(clone, snapshot.animations)
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
