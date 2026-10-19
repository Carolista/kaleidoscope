import type { ComponentProps } from 'react'
import styles from './AdminForm.module.css'

export default function AdminForm({
	className,
	...props
}: ComponentProps<'form'>) {
	return (
		<form
			{...props}
			className={className ? `${styles.form} ${className}` : styles.form}
		/>
	)
}
