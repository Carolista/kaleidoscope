import type {
	ComponentProps,
	ComponentPropsWithRef,
	CSSProperties,
} from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import styles from './IconButton.module.css'

export type IconButtonSize = 'md' | 'sm'

const SIZES: Readonly<Record<IconButtonSize, string>> = {
	md: '2.5rem',
	sm: '1.875rem',
}

export interface IconButtonProps extends Omit<
	ComponentPropsWithRef<'button'>,
	'children' | 'aria-label'
> {
	// A Font Awesome icon definition (e.g. `faEraser` from
	// `@fortawesome/sharp-duotone-solid-svg-icons`), imported by the caller so each
	// icon is tree-shaken individually rather than bundling the whole kit.
	readonly icon: IconDefinition
	// Accessible name. Also used as the visible tooltip unless `title` is
	// given separately (e.g. undo/redo add a keyboard shortcut hint).
	readonly label: string
	readonly title?: string
	readonly size?: IconButtonSize
	// Shows a small dot on the button to draw attention to something new.
	readonly badge?: boolean
	readonly iconStyle?: ComponentProps<typeof FontAwesomeIcon>['style']
}

function IconButton({
	icon,
	label,
	title,
	size = 'md',
	badge = false,
	type = 'button',
	className,
	style,
	iconStyle,
	...props
}: IconButtonProps) {
	return (
		<button
			{...props}
			type={type}
			className={[styles.button, className].filter(Boolean).join(' ')}
			style={
				{ '--icon-button-size': SIZES[size], ...style } as CSSProperties
			}
			aria-label={label}
			title={title ?? label}
		>
			<FontAwesomeIcon icon={icon} aria-hidden="true" style={iconStyle} />
			{badge && <span className={styles.badge} aria-hidden="true" />}
		</button>
	)
}

export default IconButton
