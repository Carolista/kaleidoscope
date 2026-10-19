import Spinner from './Spinner'
import styles from './Loading.module.css'

interface LoadingProps {
	readonly label: string
	readonly variant?: 'compact' | 'section'
	readonly className?: string
}

export default function Loading({
	label,
	variant = 'compact',
	className,
}: LoadingProps) {
	return (
		<div
			role="status"
			className={[styles.loading, styles[variant], className]
				.filter(Boolean)
				.join(' ')}
		>
			<Spinner />
			<span>{label}</span>
		</div>
	)
}
