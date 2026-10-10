import type { CSSProperties } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import styles from './IconButton.module.css'

export type IconButtonSize = 'md' | 'sm'

const SIZES: Readonly<Record<IconButtonSize, string>> = {
	md: '2.5rem',
	sm: '1.875rem',
}

export interface IconButtonProps {
	// A Font Awesome icon definition (e.g. `faEraser` from
	// `@fortawesome/pro-solid-svg-icons`), imported by the caller so each
	// icon is tree-shaken individually rather than bundling the whole kit.
	readonly icon: IconDefinition
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
			<FontAwesomeIcon icon={icon} aria-hidden="true" />
		</button>
	)
}

export default IconButton
