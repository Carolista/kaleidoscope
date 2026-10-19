import { lazy, Suspense } from 'react'
import App from './App'
import { AppStateProvider } from './state/AppContext'
import Loading from './components/shared/Loading'
import styles from './AppEntry.module.css'
import { NavigationGuardProvider } from '@/ui/navigation'
import useAdminRoute from '@/app/useAdminRoute'

const AdminPortal = lazy(() => import('./components/admin/AdminPortal'))

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
		<AppStateProvider>
			<App />
		</AppStateProvider>
	)
}

export default function AppEntry() {
	return (
		<NavigationGuardProvider>
			<Entry />
		</NavigationGuardProvider>
	)
}
