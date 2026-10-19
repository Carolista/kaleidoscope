import { Button } from '@shared'
import styles from './AdminPortal.module.css'

export default function AdminNavigation<T extends string>({
	label,
	items,
	value,
	onChange,
}: {
	readonly label: string
	readonly items: readonly { readonly value: T; readonly label: string }[]
	readonly value: T
	readonly onChange: (value: T) => void
}) {
	return (
		<nav aria-label={label} className={styles.catalogNavigation}>
			{items.map(item => (
				<Button
					key={item.value}
					aria-current={value === item.value ? 'page' : undefined}
					onClick={() => {
						if (value !== item.value) onChange(item.value)
					}}
				>
					{item.label}
				</Button>
			))}
		</nav>
	)
}
