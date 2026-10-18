import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styles from './AdminPortal.module.css'

export default function AdminIconButton({
	icon,
	label,
	disabled,
	onClick,
	className = '',
}: {
	readonly icon: IconDefinition
	readonly label: string
	readonly disabled?: boolean
	readonly onClick: () => void
	readonly className?: string
}) {
	return (
		<button
			type="button"
			className={`${styles.cardAction} ${className}`}
			aria-label={label}
			title={label}
			disabled={disabled}
			onClick={onClick}
		>
			<FontAwesomeIcon icon={icon} aria-hidden="true" />
		</button>
	)
}
