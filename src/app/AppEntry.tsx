import { lazy, Suspense } from 'react'
import { ZenStateProvider } from '@/features/zen'
import { Loading } from '@/ui/components'
import { PlayerContentProvider } from '@/ui/content'
import PlayerApp from './PlayerApp'
import styles from './AppEntry.module.css'
import { NavigationGuardProvider } from '@/ui/navigation'
import useAdminRoute from './useAdminRoute'

const AdminPortal = lazy(() => import('@/features/admin'))

function Entry() {
	const admin = useAdminRoute()
	return admin ? (
		<Suspense
			fallback={
				<Loading
					label="Loading admin sign-in…"
					variant="section"
					className={styles.adminLoading}
				/>
			}
		>
			<AdminPortal />
		</Suspense>
	) : (
		<PlayerContentProvider>
			<ZenStateProvider>
				<PlayerApp />
			</ZenStateProvider>
		</PlayerContentProvider>
	)
}

export default function AppEntry() {
	return (
		<NavigationGuardProvider>
			<Entry />
		</NavigationGuardProvider>
	)
}
