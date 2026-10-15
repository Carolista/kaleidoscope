import { useCallback, useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import styles from './GridTransition.module.css'

// Tuning knobs for the swap. The outgoing grid gathers itself into the
// center with a slow, easing-in turn; the incoming one unfurls with a soft
// overshoot, like a kaleidoscope settling into place.
export const EXIT_MS = 420
export const ENTER_MS = 760
const EXIT_EASING = 'cubic-bezier(0.5, 0, 0.75, 0.4)'
const ENTER_EASING = 'cubic-bezier(0.34, 1.2, 0.64, 1)'
const HEIGHT_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'
const EXIT_TURN_DEG = -24
const ENTER_TURN_DEG = 24
const MIN_SCALE = 0.02

interface Snapshot {
	readonly clone: HTMLElement
	readonly left: number
	readonly top: number
	readonly width: number
	readonly height: number
	readonly transform: string
	readonly opacity: string
}

function captureSnapshot(node: HTMLElement): Snapshot {
	// If the grid is replaced mid-entrance, start from how it looks right now.
	const { transform, opacity } = getComputedStyle(node)
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
		opacity,
	}
}

function prefersReducedMotion() {
	return (
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	)
}

interface GridTransitionProps {
	// Identifies the grid being shown (shape + size). A change replaces it.
	readonly gridKey: string
	readonly children: ReactNode
}

function GridTransition({ gridKey, children }: GridTransitionProps) {
	const stageRef = useRef<HTMLDivElement>(null)
	const layerRef = useRef<HTMLDivElement | null>(null)
	const snapshotRef = useRef<Snapshot | null>(null)
	const previousKeyRef = useRef<string | null>(null)

	// React 19 ref cleanup runs while the outgoing layer is still in the DOM,
	// the only moment its painted state can be copied for the exit animation.
	const layerCallbackRef = useCallback((node: HTMLDivElement | null) => {
		layerRef.current = node
		if (!node) return
		return () => {
			snapshotRef.current = captureSnapshot(node)
			layerRef.current = null
		}
	}, [])

	useLayoutEffect(() => {
		const stage = stageRef.current
		const layer = layerRef.current
		const snapshot = snapshotRef.current
		snapshotRef.current = null
		const previousKey = previousKeyRef.current
		previousKeyRef.current = gridKey

		if (
			!stage ||
			!layer ||
			!snapshot ||
			previousKey === null ||
			previousKey === gridKey ||
			typeof layer.animate !== 'function' ||
			prefersReducedMotion()
		) {
			return
		}

		const { clone } = snapshot
		Object.assign(clone.style, {
			position: 'absolute',
			left: `${snapshot.left}px`,
			top: `${snapshot.top}px`,
			width: `${snapshot.width}px`,
			height: `${snapshot.height}px`,
			pointerEvents: 'none',
		})
		stage.appendChild(clone)

		const startTransform =
			snapshot.transform === 'none' ? 'scale(1)' : snapshot.transform
		const exit = clone.animate(
			[
				{ transform: startTransform, opacity: snapshot.opacity },
				{
					transform: `scale(${MIN_SCALE}) rotate(${EXIT_TURN_DEG}deg)`,
					opacity: 0,
				},
			],
			{ duration: EXIT_MS, easing: EXIT_EASING, fill: 'forwards' },
		)
		exit.onfinish = () => clone.remove()

		// Hidden (and inert) until the old grid has gone.
		layer.style.pointerEvents = 'none'
		const enter = layer.animate(
			[
				{
					transform: `scale(${MIN_SCALE}) rotate(${ENTER_TURN_DEG}deg)`,
					opacity: 0,
				},
				{ opacity: 1, offset: 0.4 },
				{ transform: 'none', opacity: 1 },
			],
			{
				duration: ENTER_MS,
				delay: EXIT_MS,
				easing: ENTER_EASING,
				fill: 'backwards',
			},
		)
		enter.onfinish = () => {
			layer.style.pointerEvents = ''
		}

		// Hold the old height while it shrinks, then ease the layout (and the
		// controls below) to the new grid's height instead of snapping.
		const height = stage.animate(
			[
				{ minHeight: `${snapshot.height}px` },
				{
					minHeight: `${snapshot.height}px`,
					offset: EXIT_MS / (EXIT_MS + ENTER_MS),
				},
				{ minHeight: '0px' },
			],
			{ duration: EXIT_MS + ENTER_MS, easing: HEIGHT_EASING },
		)

		return () => {
			exit.cancel()
			enter.cancel()
			height.cancel()
			clone.remove()
			layer.style.pointerEvents = ''
		}
	}, [gridKey])

	return (
		<div ref={stageRef} className={styles.stage}>
			<div key={gridKey} ref={layerCallbackRef} className={styles.layer}>
				{children}
			</div>
		</div>
	)
}

export default GridTransition
