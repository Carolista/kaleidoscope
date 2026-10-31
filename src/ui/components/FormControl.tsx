import { useLayoutEffect, useRef, type ComponentPropsWithRef } from 'react'
import styles from './FormControl.module.css'

export function Input({ className, ...props }: ComponentPropsWithRef<'input'>) {
	return (
		<input
			className={[styles.control, className].filter(Boolean).join(' ')}
			{...props}
		/>
	)
}

export function Select({
	className,
	...props
}: ComponentPropsWithRef<'select'>) {
	return (
		<select
			className={[styles.control, className].filter(Boolean).join(' ')}
			{...props}
		/>
	)
}

// Grows as the person types, so what they are writing stays in view, instead of holding a
// fixed height and scrolling. `autoGrow={false}` keeps a fixed height the person can drag.
export function Textarea({
	className,
	autoGrow = true,
	ref,
	onInput,
	...props
}: ComponentPropsWithRef<'textarea'> & { readonly autoGrow?: boolean }) {
	const element = useRef<HTMLTextAreaElement | null>(null)

	// Also on mount and when the text is set from outside, which fire no input event.
	useLayoutEffect(() => {
		const textarea = element.current
		if (!autoGrow || !textarea) return
		fitToText(textarea)
		// A change of width rewraps the text, which changes its height.
		let width = textarea.clientWidth
		const observer = new ResizeObserver(() => {
			if (textarea.clientWidth === width) return
			width = textarea.clientWidth
			fitToText(textarea)
		})
		observer.observe(textarea)
		return () => observer.disconnect()
	}, [autoGrow, props.value])

	return (
		<textarea
			ref={node => {
				element.current = node
				if (typeof ref === 'function') ref(node)
				else if (ref) ref.current = node
			}}
			className={[
				styles.control,
				styles.textarea,
				autoGrow && styles.autoGrow,
				className,
			]
				.filter(Boolean)
				.join(' ')}
			onInput={event => {
				if (autoGrow) fitToText(event.currentTarget)
				onInput?.(event)
			}}
			{...props}
		/>
	)
}

function fitToText(textarea: HTMLTextAreaElement) {
	// Measured from a collapsed height, or a field could only ever get taller.
	textarea.style.height = 'auto'
	const borders = textarea.offsetHeight - textarea.clientHeight
	textarea.style.height = `${textarea.scrollHeight + borders}px`
}
