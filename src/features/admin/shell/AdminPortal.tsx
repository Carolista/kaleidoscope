import { useLayoutEffect, useState, type CSSProperties } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { getThemeColors } from '@/domain/palettes'
import { errorMessage } from '@/features/admin/common'
import styles from './AdminPortal.module.css'
import AdminHeader from './AdminHeader'
import AdminSession from './AdminSession'
import { NavigationGuardBoundary, NavigationGuardDialog } from '@/ui/navigation'

function AdminPage() {
	const [light, setLight] = useState(false)
	const { base, accent } = getThemeColors(!light)
	useLayoutEffect(() => {
		document.documentElement.style.backgroundColor = base
		document.body.style.backgroundColor = base
	}, [base])
	const [connection] = useState(() => {
		try {
			return { client: getSupabaseClient() }
		} catch (cause) {
			return {
				error: errorMessage(cause, 'Unable to configure Supabase.'),
			}
		}
	})
	return (
		<main
			className={styles.page}
			data-theme={light ? 'light' : 'dark'}
			style={{ '--base': base, '--accent': accent } as CSSProperties}
		>
			{connection.client ? (
				<AdminSession
					client={connection.client}
					light={light}
					onToggleTheme={() => setLight(value => !value)}
				/>
			) : (
				<>
					<AdminHeader
						light={light}
						onToggleTheme={() => setLight(value => !value)}
					/>
					<p role="alert">{connection.error}</p>
				</>
			)}
			<NavigationGuardDialog />
		</main>
	)
}

export default function AdminPortal() {
	return (
		<NavigationGuardBoundary>
			<AdminPage />
		</NavigationGuardBoundary>
	)
}
