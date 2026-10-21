import type { ComponentPropsWithRef } from 'react'
import styles from './Button.module.css'

export type ButtonVariant = 'solid' | 'outline' | 'primary' | 'link' | 'danger'

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
	readonly variant?: ButtonVariant
}

function Button({
	variant = 'solid',
	type = 'button',
	className,
	...props
}: ButtonProps) {
	return (
		<button
			type={type}
			className={[styles.button, styles[variant], className]
				.filter(Boolean)
				.join(' ')}
			{...props}
		/>
	)
}

export default Button
