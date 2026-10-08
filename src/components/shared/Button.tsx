import type { ReactNode } from 'react'
import styles from './Button.module.css'

export type ButtonVariant = 'solid' | 'outline'

export interface ButtonProps {
	// 'solid' (filled, accent background) is for the primary/confirming
	// action; 'outline' is for a secondary action like cancel.
	readonly variant?: ButtonVariant
	readonly disabled?: boolean
	readonly onClick: () => void
	readonly children: ReactNode
}

function Button({
	variant = 'solid',
	disabled,
	onClick,
	children,
}: ButtonProps) {
	return (
		<button
			type="button"
			className={`${styles.button} ${styles[variant]}`}
			disabled={disabled}
			onClick={onClick}
		>
			{children}
		</button>
	)
}

export default Button
