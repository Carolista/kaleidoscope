import { useId, type ReactNode } from 'react'
import styles from './FormField.module.css'

interface FieldAttributes {
	readonly id: string
	readonly 'aria-describedby'?: string
	readonly 'aria-invalid'?: true
}

export default function FormField({
	id,
	label,
	help,
	error,
	children,
}: {
	readonly id?: string
	readonly label: ReactNode
	readonly help?: ReactNode
	readonly error?: ReactNode
	readonly children: (attributes: FieldAttributes) => ReactNode
}) {
	const generatedId = useId()
	const fieldId = id ?? generatedId
	const describedBy =
		[help ? `${fieldId}-help` : '', error ? `${fieldId}-error` : '']
			.filter(Boolean)
			.join(' ') || undefined
	return (
		<div className={styles.field}>
			<label htmlFor={fieldId}>{label}</label>
			{children({
				id: fieldId,
				'aria-describedby': describedBy,
				'aria-invalid': error ? true : undefined,
			})}
			{help && (
				<p id={`${fieldId}-help`} className={styles.help}>
					{help}
				</p>
			)}
			{error && (
				<p
					id={`${fieldId}-error`}
					className={styles.error}
					role="alert"
				>
					{error}
				</p>
			)}
		</div>
	)
}
