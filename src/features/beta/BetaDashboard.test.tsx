import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	BetaInviteRefused,
	type BetaApi,
	type BetaDashboardData,
	type BetaRound,
} from './betaApi'
import BetaDashboard, { type BetaAccount } from './BetaDashboard'
import type { ReportApi } from './betaReports'

const NOW = Date.parse('2026-11-10T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

function round(overrides: Partial<BetaRound> = {}): BetaRound {
	return {
		id: 'round-1',
		name: 'Fall Beta',
		startsAt: NOW - DAY,
		endsAt: NOW + 10 * DAY,
		welcome: 'Thank you for testing!',
		instructions: 'Try every shape.',
		surveyVersion: 1,
		surveySubmitted: false,
		announcements: [],
		...overrides,
	}
}

function data(
	rounds: BetaRound[],
	overrides: Partial<BetaDashboardData> = {},
): BetaDashboardData {
	return { serverNow: NOW, preview: false, rounds, ...overrides }
}

function fakeApi(
	dashboard: BetaDashboardData | Error,
	redeem: () => Promise<void> = () => Promise.resolve(),
) {
	const api: BetaApi = {
		loadDashboard: vi.fn(() =>
			dashboard instanceof Error
				? Promise.reject(dashboard)
				: Promise.resolve(dashboard),
		),
		redeemInvite: vi.fn(redeem),
	}
	return api
}

const signedIn: BetaAccount = {
	status: 'signedIn',
	userId: 'user-1',
	firstName: 'Sam',
}

function renderDashboard(
	props: Partial<ComponentProps<typeof BetaDashboard>> = {},
) {
	const onInviteHandled = vi.fn()
	render(
		<BetaDashboard
			account={signedIn}
			invite={null}
			onInviteHandled={onInviteHandled}
			gameUrl="https://example.com/kaleidoscope/"
			{...props}
		/>,
	)
	return { onInviteHandled }
}

beforeEach(() => {
	vi.spyOn(Date, 'now').mockReturnValue(NOW)
})
afterEach(() => vi.restoreAllMocks())

const reportApi: ReportApi = {
	upload: vi.fn(() => Promise.resolve()),
	remove: vi.fn(() => Promise.resolve()),
	submit: vi.fn(() => Promise.resolve()),
	loadHistory: vi.fn(() => Promise.resolve([])),
}

describe('BetaDashboard', () => {
	it('waits for the account, then asks a guest to sign in', async () => {
		const onSignIn = vi.fn()
		const { rerender } = render(
			<BetaDashboard
				account={{ status: 'loading', userId: null, firstName: null }}
				invite={null}
				onInviteHandled={vi.fn()}
				gameUrl="/"
			/>,
		)
		expect(screen.getByRole('status')).toHaveTextContent('Loading…')
		rerender(
			<BetaDashboard
				account={{ status: 'signedOut', userId: null, firstName: null }}
				onSignIn={onSignIn}
				invite={null}
				onInviteHandled={vi.fn()}
				gameUrl="/"
			/>,
		)
		expect(screen.getByText(/invited beta testers/)).toBeInTheDocument()
		await userEvent.click(
			screen.getByRole('button', {
				name: 'Sign in or create an account',
			}),
		)
		expect(onSignIn).toHaveBeenCalled()
	})

	it('welcomes a guest who has an invite link', () => {
		render(
			<BetaDashboard
				account={{ status: 'signedOut', userId: null, firstName: null }}
				onSignIn={vi.fn()}
				invite="token-token-token-token"
				onInviteHandled={vi.fn()}
				gameUrl="/"
			/>,
		)
		expect(screen.getByText(/You are invited to test/)).toBeInTheDocument()
	})

	it('says so when the build has no accounts', () => {
		render(
			<BetaDashboard
				account={{
					status: 'unavailable',
					userId: null,
					firstName: null,
				}}
				invite={null}
				onInviteHandled={vi.fn()}
				gameUrl="/"
			/>,
		)
		expect(screen.getByText(/not available right now/)).toBeInTheDocument()
	})

	it('shows the current round with its countdown, link, welcome, announcements, and instructions', async () => {
		const api = fakeApi(
			data([
				round({
					announcements: [
						{
							id: 'a1',
							title: 'Version 2 is out',
							body: 'Please update.',
							pinned: true,
							publishedAt: NOW - HOUR,
						},
					],
				}),
			]),
		)
		renderDashboard({ api })
		expect(
			await screen.findByRole('heading', { name: 'Fall Beta' }),
		).toBeInTheDocument()
		expect(screen.getByText('10 days left')).toBeInTheDocument()
		expect(screen.getByText('Thank you for testing!')).toBeInTheDocument()
		expect(screen.getByText('Version 2 is out')).toBeInTheDocument()
		expect(screen.getByText('Please update.')).toBeInTheDocument()
		expect(screen.getByText('Try every shape.')).toBeInTheDocument()
		const link = screen.getByRole('link', { name: /Play Now/ })
		expect(link).toHaveAttribute(
			'href',
			'https://example.com/kaleidoscope/',
		)
		expect(link).toHaveAttribute('target', '_blank')
		expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
		expect(api.redeemInvite).not.toHaveBeenCalled()
	})

	it('colors the countdown by how close the deadline is', async () => {
		renderDashboard({
			api: fakeApi(data([round({ endsAt: NOW + 5 * DAY })])),
		})
		expect(await screen.findByText('5 days left')).toHaveAttribute(
			'data-tone',
			'yellow',
		)
	})

	it('counts down in hours and minutes in the last 72 hours, using the server clock', async () => {
		// The device's clock is a day behind the server's.
		vi.spyOn(Date, 'now').mockReturnValue(NOW - DAY)
		renderDashboard({
			api: fakeApi(
				data([round({ endsAt: NOW + 5 * HOUR + 7 * 60 * 1000 })]),
			),
		})
		expect(
			await screen.findByText('5 hours, 7 minutes left'),
		).toBeInTheDocument()
	})

	it('keeps the countdown moving and closes the round when time runs out', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true })
		try {
			vi.setSystemTime(NOW)
			renderDashboard({
				api: fakeApi(data([round({ endsAt: NOW + 2 * 60 * 1000 })])),
			})
			expect(
				await screen.findByText('2 minutes left'),
			).toBeInTheDocument()
			await act(() => vi.advanceTimersByTimeAsync(3 * 60 * 1000))
			expect(
				screen.getByText(/This beta round has ended/),
			).toBeInTheDocument()
		} finally {
			vi.useRealTimers()
		}
	})

	it('counts down to a round that has not started', async () => {
		renderDashboard({
			api: fakeApi(
				data([
					round({ startsAt: NOW + 4 * DAY, endsAt: NOW + 20 * DAY }),
				]),
			),
		})
		expect(
			await screen.findByText('The beta starts in 4 days.'),
		).toBeInTheDocument()
	})

	it('shows an ended round, and still offers the game', async () => {
		renderDashboard({
			api: fakeApi(
				data([round({ startsAt: NOW - 20 * DAY, endsAt: NOW - DAY })]),
			),
		})
		expect(
			await screen.findByText(/This beta round has ended/),
		).toBeInTheDocument()
		expect(screen.getByRole('link', { name: /Play Now/ })).toBeVisible()
	})

	it('shows the round in progress rather than a newer one that has not started', async () => {
		renderDashboard({
			api: fakeApi(
				data([
					round({
						id: 'later',
						name: 'Spring Beta',
						startsAt: NOW + 30 * DAY,
						endsAt: NOW + 40 * DAY,
					}),
					round(),
					round({
						id: 'earlier',
						name: 'Summer Beta',
						startsAt: NOW - 90 * DAY,
						endsAt: NOW - 60 * DAY,
					}),
				]),
			),
		})
		expect(
			await screen.findByRole('heading', { name: 'Fall Beta' }),
		).toBeInTheDocument()
		expect(screen.queryByText('Spring Beta')).not.toBeInTheDocument()
	})

	it('tells a player who is not a tester how to join', async () => {
		renderDashboard({ api: fakeApi(data([])) })
		expect(
			await screen.findByText(/open the link in your invitation email/),
		).toBeInTheDocument()
	})

	it('says there are no rounds yet to an admin', async () => {
		renderDashboard({ api: fakeApi(data([], { preview: true })) })
		expect(
			await screen.findByText('There are no beta rounds yet.'),
		).toBeInTheDocument()
	})

	it('can try again after the page fails to load', async () => {
		const api = fakeApi(new Error('offline'))
		renderDashboard({ api })
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'could not be loaded',
		)
		vi.mocked(api.loadDashboard).mockResolvedValue(data([round()]))
		await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
		expect(
			await screen.findByRole('heading', { name: 'Fall Beta' }),
		).toBeInTheDocument()
	})

	describe('feedback forms', () => {
		const tab = { name: 'Report a Bug' }

		it('are offered to a tester while the round is open', async () => {
			renderDashboard({ api: fakeApi(data([round()])), reportApi })
			expect(await screen.findByRole('button', tab)).toBeInTheDocument()
		})

		it('are left out of an admin preview, an unstarted or ended round, and without somewhere to send them', async () => {
			const cases = [
				fakeApi(data([round()], { preview: true })),
				fakeApi(
					data([
						round({ startsAt: NOW + DAY, endsAt: NOW + 5 * DAY }),
					]),
				),
				fakeApi(
					data([
						round({ startsAt: NOW - 5 * DAY, endsAt: NOW - DAY }),
					]),
				),
			]
			for (const api of cases) {
				const { unmount } = render(
					<BetaDashboard
						account={signedIn}
						invite={null}
						onInviteHandled={vi.fn()}
						gameUrl="/"
						api={api}
						reportApi={reportApi}
					/>,
				)
				await screen.findByRole('article')
				expect(
					screen.queryByRole('button', tab),
				).not.toBeInTheDocument()
				unmount()
			}
			renderDashboard({ api: fakeApi(data([round()])) })
			await screen.findByRole('article')
			expect(screen.queryByRole('button', tab)).not.toBeInTheDocument()
		})

		it('go away when the round ends while the page is open', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true })
			try {
				vi.setSystemTime(NOW)
				renderDashboard({
					api: fakeApi(data([round({ endsAt: NOW + 60 * 1000 })])),
					reportApi,
				})
				expect(
					await screen.findByRole('button', tab),
				).toBeInTheDocument()
				await act(() => vi.advanceTimersByTimeAsync(2 * 60 * 1000))
				expect(
					screen.queryByRole('button', tab),
				).not.toBeInTheDocument()
			} finally {
				vi.useRealTimers()
			}
		})
	})

	describe('with an invite link', () => {
		const invite = 'token-token-token-token'

		it('joins first, then loads the page, and hands the invite back once', async () => {
			const api = fakeApi(data([round()]))
			const { onInviteHandled } = renderDashboard({ api, invite })
			expect(
				await screen.findByRole('heading', { name: 'Fall Beta' }),
			).toBeInTheDocument()
			expect(api.redeemInvite).toHaveBeenCalledWith(invite)
			expect(api.redeemInvite).toHaveBeenCalledTimes(1)
			expect(api.loadDashboard).toHaveBeenCalledTimes(1)
			expect(onInviteHandled).toHaveBeenCalledTimes(1)
		})

		it('says why a link the server refused did not work, and drops it', async () => {
			const api = fakeApi(data([]), () =>
				Promise.reject(
					new BetaInviteRefused(
						'This invite link has already been used.',
					),
				),
			)
			const { onInviteHandled } = renderDashboard({ api, invite })
			expect(await screen.findByRole('alert')).toHaveTextContent(
				'This invite link has already been used.',
			)
			expect(onInviteHandled).toHaveBeenCalledTimes(1)
			expect(
				screen.getByText(/open the link in your invitation email/),
			).toBeInTheDocument()
		})

		it('keeps the link when it could not reach the server, and uses it on retry', async () => {
			const redeem = vi
				.fn<() => Promise<void>>()
				.mockRejectedValueOnce(new Error('offline'))
				.mockResolvedValue(undefined)
			const api = fakeApi(data([round()]), redeem)
			const { onInviteHandled } = renderDashboard({ api, invite })
			expect(await screen.findByRole('alert')).toHaveTextContent(
				'invite link could not be used',
			)
			expect(onInviteHandled).not.toHaveBeenCalled()
			await userEvent.click(
				screen.getByRole('button', { name: 'Try again' }),
			)
			await waitFor(() =>
				expect(onInviteHandled).toHaveBeenCalledTimes(1),
			)
			expect(
				await screen.findByRole('heading', { name: 'Fall Beta' }),
			).toBeInTheDocument()
			expect(redeem).toHaveBeenCalledTimes(2)
		})
	})
})
