import type { ComponentPropsWithRef } from 'react'
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
