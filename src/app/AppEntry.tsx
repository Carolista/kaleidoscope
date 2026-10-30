import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { AccountProvider, useAccount } from '@/features/account'
import { ZenStateProvider } from '@/features/zen'
import { Loading } from '@/ui/components'
import { PlayerContentProvider } from '@/ui/content'
import BetaApp from './BetaApp'
import { readBetaInvite } from './betaInvite'
import PlayerApp from './PlayerApp'
import ProvisionalTheme from './ProvisionalTheme'
import styles from './AppEntry.module.css'
import { NavigationGuardProvider } from '@/ui/navigation'
import useAppRoute from './useAppRoute'

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

// A player who left an invite link to confirm their email returns to the app root, signed
// in; the page that uses the invite is where they go next.
function BetaInviteForwarder() {
	const { status } = useAccount()
	useEffect(() => {
		if (status === 'signedIn' && readBetaInvite())
			window.location.hash = '#/beta'
	}, [status])
	return null
}

function Entry() {
	const route = useAppRoute()
	if (route === 'admin')
		return (
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
		)
	return (
		<AccountProvider>
			{route === 'beta' ? (
				<ProvisionalTheme>
					<BetaApp />
				</ProvisionalTheme>
			) : (
				<>
					<BetaInviteForwarder />
					<PlayerContent>
						<ZenStateProvider>
							<PlayerApp />
						</ZenStateProvider>
					</PlayerContent>
				</>
			)}
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
