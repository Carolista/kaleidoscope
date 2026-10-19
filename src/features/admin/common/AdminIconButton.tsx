import { IconButton } from '@/ui/components'
import type { IconButtonProps } from '@/ui/components'
import styles from './AdminIconButton.module.css'

export default function AdminIconButton({
	tone,
	className,
	...props
}: IconButtonProps & {
	// Blue for edits, red for removals and deletions.
	readonly tone?: 'edit' | 'delete'
}) {
	const classes = [tone && styles[tone], className].filter(Boolean).join(' ')
	return <IconButton size="sm" {...props} className={classes || undefined} />
}
