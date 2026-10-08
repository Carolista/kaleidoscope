import type { CSSProperties } from 'react'
import styles from './IconButton.module.css'

export type IconButtonSize = 'md' | 'sm'

const SIZES: Readonly<Record<IconButtonSize, string>> = {
	md: '2.5rem',
	sm: '1.875rem',
}

export interface IconButtonProps {
	// Font Awesome icon name, without the `fa-` prefix (e.g. 'eraser').
	readonly icon: string
	// Accessible name. Also used as the visible tooltip unless `title` is
	// given separately (e.g. undo/redo add a keyboard shortcut hint).
	readonly label: string
	readonly title?: string
	readonly size?: IconButtonSize
	readonly disabled?: boolean
	readonly onClick: () => void
}

function IconButton({
	icon,
	label,
	title,
	size = 'md',
	disabled,
	onClick,
}: IconButtonProps) {
	return (
		<button
			type="button"
			className={styles.button}
			style={{ '--icon-button-size': SIZES[size] } as CSSProperties}
			aria-label={label}
			title={title ?? label}
			disabled={disabled}
			onClick={onClick}
		>
			<i className={`fa-solid fa-${icon}`} aria-hidden="true"></i>
		</button>
	)
}

export default IconButton
