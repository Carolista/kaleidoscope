import { useCallback, useEffect, useRef, useState } from 'react'
import {
	BetaInviteRefused,
	type BetaApi,
	type BetaDashboardData,
} from './betaApi'

export type BetaState =
	| { readonly status: 'loading' }
	| { readonly status: 'joining' }
	| { readonly status: 'failed'; readonly message: string }
	| {
			readonly status: 'ready'
			readonly data: BetaDashboardData
			// The device's clock when the data arrived, to keep the server's time moving.
			readonly localAt: number
			// Why an invite link did not work, when it did not.
			readonly notice: string | null
	  }

// Joins the beta with an invite link's token, when there is one, then reads the page's data.
// A link the server turned down is dropped (it cannot work later); a link that failed to
// reach the server is kept, so trying again can still use it.
export default function useBetaDashboard({
	api,
	userId,
	invite,
	onInviteHandled,
}: {
	readonly api: BetaApi
	readonly userId: string
	readonly invite: string | null
	readonly onInviteHandled: () => void
}): { state: BetaState; retry: () => void } {
	const [state, setState] = useState<BetaState>({
		status: invite ? 'joining' : 'loading',
	})
	const [attempt, setAttempt] = useState(0)
	// Handling the invite clears it, which must not start the work over.
	const latest = useRef({ invite, onInviteHandled })
	useEffect(() => {
		latest.current = { invite, onInviteHandled }
	})

	useEffect(() => {
		let cancelled = false
		async function run() {
			let notice: string | null = null
			const token = latest.current.invite
			if (token) {
				try {
					await api.redeemInvite(token)
					latest.current.onInviteHandled()
				} catch (error) {
					if (cancelled) return
					if (error instanceof BetaInviteRefused) {
						latest.current.onInviteHandled()
						notice = error.message
					} else {
						setState({
							status: 'failed',
							message:
								'The invite link could not be used. Check your connection and try again.',
						})
						return
					}
				}
				if (cancelled) return
				setState({ status: 'loading' })
			}
			try {
				const data = await api.loadDashboard()
				if (!cancelled)
					setState({
						status: 'ready',
						data,
						localAt: Date.now(),
						notice,
					})
			} catch {
				if (!cancelled)
					setState({
						status: 'failed',
						message:
							'The beta page could not be loaded. Check your connection and try again.',
					})
			}
		}
		void run()
		return () => {
			cancelled = true
		}
	}, [api, userId, attempt])

	const retry = useCallback(() => {
		setState({ status: 'loading' })
		setAttempt(count => count + 1)
	}, [])
	return { state, retry }
}
