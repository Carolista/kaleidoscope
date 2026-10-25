import {
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
	type RefObject,
} from 'react'

const DURATION_MS = 560
const EASING = 'cubic-bezier(0.2, 0.8, 0.4, 1)'

function canAnimate() {
	return (
		typeof Element.prototype.animate === 'function' &&
		!(
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		)
	)
}

// Draws its children over the spot it is placed in. Opening grows them out of
// `fromRef`'s element (fading in as they go), and closing runs that backwards.
// Without animation support, or when the player prefers less motion, it simply
// appears and disappears.
//
// `onSettledChange(true)` fires once the overlay is fully in place and
// `(false)` as soon as it starts to leave, so what is underneath can be hidden
// only while it is covered.
export default function PeekOverlay({
	open,
	fromRef,
	onClose,
	onSettledChange,
	className,
	children,
}: {
	readonly open: boolean
	// The element the overlay grows from and shrinks back to.
	readonly fromRef: RefObject<Element | null>
	readonly onClose: () => void
	readonly onSettledChange: (settled: boolean) => void
	readonly className?: string
	readonly children: ReactNode
}) {
	const node = useRef<HTMLDivElement>(null)
	const animation = useRef<Animation | null>(null)
	const [closing, setClosing] = useState(false)
	const [wasOpen, setWasOpen] = useState(open)
	const settle = useEffectEvent(onSettledChange)

	// Stays on screen while it animates away.
	if (open !== wasOpen) {
		setWasOpen(open)
		setClosing(!open && canAnimate())
	}

	useLayoutEffect(() => {
		const element = node.current
		if (!open) {
			settle(false)
			const running = animation.current
			if (running) {
				if (running.playbackRate > 0) running.reverse()
			} else queueMicrotask(() => setClosing(false))
			return
		}
		if (!element || !canAnimate()) {
			settle(true)
			return
		}
		const existing = animation.current
		if (existing) {
			// Reopened while still on its way out.
			if (existing.playbackRate < 0) existing.reverse()
			return
		}
		const target = fromRef.current?.getBoundingClientRect()
		const place = element.querySelector('svg')?.getBoundingClientRect()
		if (!target || !place || place.width === 0) {
			settle(true)
			return
		}
		const box = element.getBoundingClientRect()
		const origin = `${place.left - box.left}px ${place.top - box.top}px`
		const started = element.animate(
			[
				{
					transformOrigin: origin,
					transform: `translate(${target.left - place.left}px, ${target.top - place.top}px) scale(${target.width / place.width})`,
					opacity: 0,
				},
				{ transformOrigin: origin, transform: 'none', opacity: 1 },
			],
			{ duration: DURATION_MS, easing: EASING, fill: 'both' },
		)
		animation.current = started
		started.onfinish = () => {
			if (started.playbackRate < 0) {
				// Not cancelled: the finished animation holds the overlay invisible
				// until React removes it. Cancelling first would flash it over the
				// board for a frame.
				animation.current = null
				setClosing(false)
			} else settle(true)
		}
	}, [open, fromRef])

	useEffect(
		() => () => {
			animation.current?.cancel()
			animation.current = null
		},
		[],
	)

	if (!open && !closing) return null
	return (
		<div
			ref={node}
			className={className}
			data-closing={open ? undefined : ''}
			aria-hidden="true"
			onClick={onClose}
		>
			{children}
		</div>
	)
}
