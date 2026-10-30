import { useMemo, type ReactNode } from 'react'
import { getPlayerClient } from '@/lib/supabase'
import { Button, Heading, Loading } from '@/ui/components'
import { supabaseBetaApi, type BetaApi, type BetaRound } from './betaApi'
import RoundView from './RoundView'
import useBetaDashboard from './useBetaDashboard'
import styles from './BetaDashboard.module.css'

export interface BetaAccount {
	// `unavailable` is a build without Supabase configured.
	readonly status: 'unavailable' | 'loading' | 'signedOut' | 'signedIn'
	readonly userId: string | null
	readonly firstName: string | null
}

// The round to show: the one in progress, else the next to start, else the latest to have ended.
function currentRound(
	rounds: readonly BetaRound[],
	now: number,
): BetaRound | undefined {
	return (
		rounds.find(round => round.startsAt <= now && now < round.endsAt) ??
		rounds.filter(round => round.startsAt > now).at(-1) ??
		rounds[0]
	)
}

function Message({
	title,
	children,
}: {
	readonly title: string
	readonly children?: ReactNode
}) {
	return (
		<section className={styles.panel}>
			<Heading level={2} className={styles.title}>
				{title}
			</Heading>
			{children}
		</section>
	)
}

function SignedIn({
	api,
	userId,
	invite,
	onInviteHandled,
	gameUrl,
}: {
	readonly api: BetaApi
	readonly userId: string
	readonly invite: string | null
	readonly onInviteHandled: () => void
	readonly gameUrl: string
}) {
	const { state, retry } = useBetaDashboard({
		api,
		userId,
		invite,
		onInviteHandled,
	})
	if (state.status === 'joining')
		return <Loading label="Joining the beta…" variant="section" />
	if (state.status === 'loading')
		return <Loading label="Loading the beta…" variant="section" />
	if (state.status === 'failed')
		return (
			<Message title="Something went wrong">
				<p role="alert" className={styles.text}>
					{state.message}
				</p>
				<Button variant="primary" onClick={retry}>
					Try again
				</Button>
			</Message>
		)

	const { data, localAt, notice } = state
	const round = currentRound(data.rounds, data.serverNow)
	return (
		<>
			{notice && (
				<p role="alert" className={styles.notice}>
					{notice}
				</p>
			)}
			{round ? (
				<RoundView
					round={round}
					serverNow={data.serverNow}
					localAt={localAt}
					preview={data.preview}
					gameUrl={gameUrl}
				/>
			) : (
				<Message title="Beta Testing">
					<p className={styles.text}>
						{data.preview
							? 'There are no beta rounds yet.'
							: 'This page is for invited beta testers. If you were invited, open the link in your invitation email while signed in.'}
					</p>
				</Message>
			)}
		</>
	)
}

// The beta testers' page. It needs a signed-in player; an invite link's token, when there is
// one, is used first to join the round. The page hosting it supplies the account and the
// sign-in dialog, since features do not reach into each other.
export default function BetaDashboard({
	account,
	onSignIn,
	invite,
	onInviteHandled,
	gameUrl,
	api: providedApi,
}: {
	readonly account: BetaAccount
	// Set where accounts can be created.
	readonly onSignIn?: () => void
	// An invite link's token that has not been used yet.
	readonly invite: string | null
	readonly onInviteHandled: () => void
	readonly gameUrl: string
	// For tests; the signed-in player's own connection otherwise.
	readonly api?: BetaApi
}) {
	const { status, userId } = account
	const api = useMemo(
		() =>
			providedApi ??
			(status === 'signedIn'
				? supabaseBetaApi(getPlayerClient())
				: undefined),
		[providedApi, status],
	)

	return (
		<div className={styles.dashboard}>
			{status === 'loading' && (
				<Loading label="Loading…" variant="section" />
			)}
			{status === 'unavailable' && (
				<Message title="Beta Testing">
					<p className={styles.text}>
						Beta testing is not available right now.
					</p>
				</Message>
			)}
			{status === 'signedOut' && (
				<Message title="Beta Testing">
					<p className={styles.text}>
						{invite
							? 'You are invited to test Kaleidoscope! Create an account or sign in to join.'
							: 'This page is for invited beta testers. Sign in to continue.'}
					</p>
					{onSignIn && (
						<Button variant="primary" onClick={onSignIn}>
							Sign in or create an account
						</Button>
					)}
				</Message>
			)}
			{status === 'signedIn' && userId && api && (
				<SignedIn
					key={userId}
					api={api}
					userId={userId}
					invite={invite}
					onInviteHandled={onInviteHandled}
					gameUrl={gameUrl}
				/>
			)}
		</div>
	)
}
