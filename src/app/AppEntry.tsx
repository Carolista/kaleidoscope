import { lazy, Suspense, type ReactNode } from 'react'
import { AccountProvider, useAccount } from '@/features/account'
import { ZenStateProvider } from '@/features/zen'
import { Loading } from '@/ui/components'
import { PlayerContentProvider } from '@/ui/content'
import PlayerApp from './PlayerApp'
import ProvisionalTheme from './ProvisionalTheme'
import styles from './AppEntry.module.css'
import { NavigationGuardProvider } from '@/ui/navigation'
import useAdminRoute from './useAdminRoute'

const AdminPortal = lazy(() => import('@/features/admin'))

// Content depends on who is playing, so it waits for the account to be known.
function PlayerContent({ children }: { readonly children: ReactNode }) {
	const { status, userId } = useAccount()
	return (
		<PlayerContentProvider
			userId={userId}
			accountResolved={status !== 'loading'}
			gate={gate => (
				<ProvisionalTheme>
					<PlayerApp gate={gate} />
				</ProvisionalTheme>
			)}
		>
			{children}
		</PlayerContentProvider>
	)
}

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
		<AccountProvider>
			<PlayerContent>
				<ZenStateProvider>
					<PlayerApp />
				</ZenStateProvider>
			</PlayerContent>
		</AccountProvider>
	)
}

export default function AppEntry() {
	return (
		<NavigationGuardProvider>
			<Entry />
		</NavigationGuardProvider>
	)
}
