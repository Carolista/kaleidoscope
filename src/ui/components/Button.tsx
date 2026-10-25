import { useContext, type ComponentPropsWithRef } from 'react'
import { TextCaseContext, titleCaseNodes } from '@/ui/text'
import styles from './Button.module.css'

export type ButtonVariant = 'solid' | 'outline' | 'primary' | 'link' | 'danger'

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
	readonly variant?: ButtonVariant
}

function Button({
	variant = 'solid',
	type = 'button',
	className,
	children,
	...props
}: ButtonProps) {
	const textCase = useContext(TextCaseContext)
	return (
		<button
			type={type}
			className={[styles.button, styles[variant], className]
				.filter(Boolean)
				.join(' ')}
			{...props}
		>
			{textCase === 'title' ? titleCaseNodes(children) : children}
		</button>
	)
}

export default Button
