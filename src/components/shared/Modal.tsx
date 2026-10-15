import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './Modal.module.css'

export const MODAL_ENTER_MS = 1000
export const MODAL_EXIT_MS = 500
const REST_FRAME = {
	opacity: 1,
	filter: 'blur(0px)',
	transform: 'translateY(0px)',
}
const HIDDEN_FRAME = {
	opacity: 0,
	filter: 'blur(8px)',
	transform: 'translateY(200px)',
}

export interface ModalProps {
	readonly open: boolean
	readonly onClose: () => void
	readonly onAfterClose?: () => void
	// id of the element (usually a heading) that labels this dialog for assistive tech.
	readonly labelledBy: string
	// Extra class merged onto the `<dialog>` element, e.g. to set a width.
	readonly className?: string
	readonly header?: ReactNode
	readonly children: ReactNode
}

let scrollLockCount = 0
let restorePageScroll: (() => void) | undefined

function lockPageScroll() {
	if (scrollLockCount === 0) {
		const { scrollX, scrollY } = window
		const body = document.body
		const root = document.documentElement
		const saved = {
			position: body.style.position,
			top: body.style.top,
			left: body.style.left,
			width: body.style.width,
			overflow: body.style.overflow,
			rootOverflow: root.style.overflow,
		}
		body.style.position = 'fixed'
		body.style.top = `${-scrollY}px`
		body.style.left = `${-scrollX}px`
		body.style.width = '100%'
		body.style.overflow = 'hidden'
		root.style.overflow = 'hidden'
		restorePageScroll = () => {
			body.style.position = saved.position
			body.style.top = saved.top
			body.style.left = saved.left
			body.style.width = saved.width
			body.style.overflow = saved.overflow
			root.style.overflow = saved.rootOverflow
			window.scrollTo({
				left: scrollX,
				top: scrollY,
				behavior: 'instant',
			})
		}
	}
	scrollLockCount++
	return () => {
		scrollLockCount--
		if (scrollLockCount === 0) {
			restorePageScroll?.()
			restorePageScroll = undefined
		}
	}
}

// Built on the native `<dialog>` element, which gives us a backdrop, focus
// trapping, and Esc-to-cancel for free. `open` is controlled by the
// parent; the dialog is imperatively shown/closed to match, since
// `<dialog>` doesn't support a declarative `open` attribute that also
// triggers modal (backdrop + focus trap) behavior.
function Modal({
	open,
	onClose,
	onAfterClose,
	labelledBy,
	className,
	header,
	children,
}: ModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null)
	const scrollRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)
	const animationRef = useRef<Animation | null>(null)
	const unlockRef = useRef<(() => void) | undefined>(undefined)
	const afterCloseRef = useRef(onAfterClose)
	const [edges, setEdges] = useState({ above: false, below: false })

	function updateEdges() {
		const scroller = scrollRef.current
		if (!scroller) return
		setEdges({
			above: scroller.scrollTop > 1,
			below:
				scroller.scrollHeight -
					scroller.clientHeight -
					scroller.scrollTop >
				1,
		})
	}

	useLayoutEffect(() => {
		afterCloseRef.current = onAfterClose
	}, [onAfterClose])

	useLayoutEffect(
		() => () => {
			if (animationRef.current) {
				animationRef.current.onfinish = null
				animationRef.current.cancel()
				animationRef.current = null
			}
			unlockRef.current?.()
			unlockRef.current = undefined
		},
		[],
	)

	useLayoutEffect(() => {
		const dialog = dialogRef.current!
		if (!open && !dialog.open) return

		const interrupted = animationRef.current
		const current = getComputedStyle(dialog)
		const start = interrupted
			? {
					opacity: current.opacity,
					filter: current.filter,
					transform: current.transform,
				}
			: open
				? HIDDEN_FRAME
				: REST_FRAME
		if (interrupted) {
			interrupted.onfinish = null
			interrupted.cancel()
			animationRef.current = null
		}

		function finishClose() {
			dialog.close()
			unlockRef.current?.()
			unlockRef.current = undefined
			afterCloseRef.current?.()
		}

		dialog.dataset.closing = String(!open)
		if (open) {
			unlockRef.current ??= lockPageScroll()
			if (!dialog.open) dialog.showModal()
		}
		const reducedMotion = window.matchMedia?.(
			'(prefers-reduced-motion: reduce)',
		).matches
		if (reducedMotion || typeof dialog.animate !== 'function') {
			if (!open) finishClose()
			return
		}

		const duration = open ? MODAL_ENTER_MS : MODAL_EXIT_MS
		dialog.style.setProperty('--modal-duration', `${duration}ms`)
		const animation = dialog.animate(
			[start, open ? REST_FRAME : HIDDEN_FRAME],
			{
				duration,
				easing: open
					? 'cubic-bezier(0.16, 1, 0.3, 1)'
					: 'cubic-bezier(0.4, 0, 1, 1)',
				fill: 'forwards',
			},
		)
		animationRef.current = animation
		animation.onfinish = () => {
			animationRef.current = null
			if (!open) finishClose()
			animation.cancel()
		}
	}, [open])

	useLayoutEffect(() => {
		if (!open) return
		const scroller = scrollRef.current!
		scroller.scrollTop = 0
		updateEdges()
		const observer = new ResizeObserver(updateEdges)
		observer.observe(scroller)
		observer.observe(contentRef.current!)
		window.addEventListener('resize', updateEdges)
		return () => {
			observer.disconnect()
			window.removeEventListener('resize', updateEdges)
		}
	}, [open])

	return (
		<dialog
			ref={dialogRef}
			onClickCapture={event => {
				if (!open) {
					event.preventDefault()
					event.stopPropagation()
				}
			}}
			className={[styles.dialog, className].filter(Boolean).join(' ')}
			aria-labelledby={labelledBy}
			onCancel={event => {
				// Native Esc-to-close; prevent the default close so our effect
				// (driven by the parent flipping `open`) stays the single source
				// of truth for when the dialog actually closes.
				event.preventDefault()
				if (open) onClose()
			}}
			onClick={event => {
				// Native backdrop clicks target the dialog, not its contents.
				if (open && event.target === dialogRef.current) onClose()
			}}
		>
			{header && <div className={styles.header}>{header}</div>}
			<div className={styles.body}>
				<div
					ref={scrollRef}
					className={styles.scroller}
					role="region"
					aria-labelledby={labelledBy}
					tabIndex={edges.above || edges.below ? 0 : -1}
					onScroll={updateEdges}
				>
					<div ref={contentRef}>{children}</div>
				</div>
				{edges.above && (
					<div
						className={`${styles.edge} ${styles.topEdge}`}
						aria-hidden="true"
					>
						<span className={styles.chevron} />
					</div>
				)}
				{edges.below && (
					<div
						className={`${styles.edge} ${styles.bottomEdge}`}
						aria-hidden="true"
					>
						<span className={styles.chevron} />
					</div>
				)}
			</div>
		</dialog>
	)
}

export default Modal
