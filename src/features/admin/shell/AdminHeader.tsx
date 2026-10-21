import { type ReactNode } from 'react'
import { AdminIconButton } from '@/features/admin/common'
import styles from './AdminHeader.module.css'
import { faSun, faMoon } from '@fortawesome/pro-solid-svg-icons'

export default function AdminHeader({
	light,
	onToggleTheme,
	children,
}: {
	readonly light: boolean
	readonly onToggleTheme: () => void
	readonly children?: ReactNode
}) {
	return (
		<header className={styles.header}>
			<div className={styles.headerBrand}>
				<a
					href="#"
					className={styles.homeButton}
					aria-label="Back to Kaleidoscope"
					title="Back to Kaleidoscope"
				>
					<img
						src={`${import.meta.env.BASE_URL}favicon.svg`}
						alt=""
					/>
				</a>
				<h1>Kaleidoscope Admin</h1>
			</div>
			<div className={styles.sessionBar}>
				{children}
				<AdminIconButton
					icon={light ? faMoon : faSun}
					label={
						light ? 'Switch to dark mode' : 'Switch to light mode'
					}
					onClick={onToggleTheme}
				/>
			</div>
		</header>
	)
}
