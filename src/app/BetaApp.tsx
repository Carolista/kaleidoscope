import { lazy, Suspense, useState, type CSSProperties } from 'react'
import { getThemeColors } from '@/domain/palettes'
import { AccountDialog, useAccount } from '@/features/account'
import { Loading } from '@/ui/components'
import { TextCaseContext } from '@/ui/text'
import { usePlayerTheme } from '@/ui/theme'
import {
	clearBetaInvite,
	captureBetaInvite,
	readBetaInvite,
} from './betaInvite'
import { Footer, Header } from './layout'
import { SettingsControl, SettingsDialog } from './settings'
import usePageBackground from './usePageBackground'
import styles from './BetaApp.module.css'

const BetaDashboard = lazy(() => import('@/features/beta'))

// The game without the beta page's address, which is where the tester plays.
function gameUrl() {
	return `${window.location.origin}${window.location.pathname}`
}

// The beta testers' page in the app's own frame (header, settings, sign-in, footer), but
// without the player's puzzle and design content, which it does not need.
export default function BetaApp() {
	const { darkMode } = usePlayerTheme()
	const { base, accent } = getThemeColors(darkMode)
	usePageBackground(base)
	const account = useAccount()
	const [accountOpen, setAccountOpen] = useState(false)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [invite, setInvite] = useState(() => {
		captureBetaInvite()
		return readBetaInvite()
	})

	return (
		<TextCaseContext.Provider value="title">
			<div
				className={styles.page}
				style={
					{
						'--base': base,
						'--accent': accent,
						backgroundColor: base,
					} as CSSProperties
				}
			>
				<Header
					onHome={() => {
						window.location.hash = ''
					}}
					actions={
						<SettingsControl onOpen={() => setSettingsOpen(true)} />
					}
				/>
				<main className={styles.main}>
					<Suspense
						fallback={
							<Loading label="Loading…" variant="section" />
						}
					>
						<BetaDashboard
							account={account}
							onSignIn={
								account.status === 'signedOut'
									? () => setAccountOpen(true)
									: undefined
							}
							invite={invite}
							onInviteHandled={() => {
								clearBetaInvite()
								setInvite(null)
							}}
							gameUrl={gameUrl()}
						/>
					</Suspense>
				</main>
				<Footer />
				<SettingsDialog
					open={settingsOpen}
					onClose={() => setSettingsOpen(false)}
					onSignIn={
						account.status === 'unavailable'
							? undefined
							: () => {
									setSettingsOpen(false)
									setAccountOpen(true)
								}
					}
				/>
				<AccountDialog
					open={accountOpen}
					onClose={() => setAccountOpen(false)}
				/>
			</div>
		</TextCaseContext.Provider>
	)
}
