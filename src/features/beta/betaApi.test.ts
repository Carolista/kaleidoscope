import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { BetaInviteRefused, parseDashboard, supabaseBetaApi } from './betaApi'

const raw = {
	now: '2026-11-10T12:00:00Z',
	preview: false,
	rounds: [
		{
			id: 'r1',
			name: 'Fall Beta',
			starts_at: '2026-11-09T12:00:00Z',
			ends_at: '2026-11-20T12:00:00Z',
			welcome: 'Hi',
			instructions: 'Test',
			survey_version: 2,
			survey_submitted: true,
			announcements: [
				{
					id: 'a1',
					title: 'News',
					body: 'Body',
					pinned: true,
					published_at: '2026-11-10T11:00:00Z',
				},
			],
		},
	],
}

describe('parseDashboard', () => {
	it('reads the server data into times in milliseconds', () => {
		const result = parseDashboard(raw)
		expect(result.serverNow).toBe(Date.parse('2026-11-10T12:00:00Z'))
		expect(result.preview).toBe(false)
		expect(result.rounds).toEqual([
			{
				id: 'r1',
				name: 'Fall Beta',
				startsAt: Date.parse('2026-11-09T12:00:00Z'),
				endsAt: Date.parse('2026-11-20T12:00:00Z'),
				welcome: 'Hi',
				instructions: 'Test',
				surveyVersion: 2,
				surveySubmitted: true,
				announcements: [
					{
						id: 'a1',
						title: 'News',
						body: 'Body',
						pinned: true,
						publishedAt: Date.parse('2026-11-10T11:00:00Z'),
					},
				],
			},
		])
	})

	it.each([
		['not an object', null],
		['a missing clock', { ...raw, now: undefined }],
		['a bad time', { ...raw, now: 'soon' }],
		['rounds that are not a list', { ...raw, rounds: {} }],
		[
			'a round without a name',
			{ ...raw, rounds: [{ ...raw.rounds[0], name: undefined }] },
		],
	])('refuses %s', (_label, value) => {
		expect(() => parseDashboard(value)).toThrow()
	})
})

function clientReturning(result: { data?: unknown; error?: unknown }) {
	const rpc = vi
		.fn()
		.mockResolvedValue({ data: null, error: null, ...result })
	return { rpc, client: { rpc } as unknown as SupabaseClient<Database> }
}

describe('supabaseBetaApi', () => {
	it('loads the dashboard through its function', async () => {
		const { rpc, client } = clientReturning({ data: raw })
		const result = await supabaseBetaApi(client).loadDashboard()
		expect(rpc).toHaveBeenCalledWith('beta_dashboard')
		expect(result.rounds).toHaveLength(1)
	})

	it('fails when the dashboard cannot be read', async () => {
		const { client } = clientReturning({
			error: { message: 'down', code: '' },
		})
		await expect(supabaseBetaApi(client).loadDashboard()).rejects.toThrow(
			'down',
		)
	})

	it('redeems an invite by its token', async () => {
		const { rpc, client } = clientReturning({ data: 'round-id' })
		await supabaseBetaApi(client).redeemInvite('tok')
		expect(rpc).toHaveBeenCalledWith('redeem_beta_invite', {
			p_token: 'tok',
		})
	})

	it.each(['22023', '42501'])(
		'reports a refusal (%s) apart from a failure to reach the server',
		async code => {
			const { client } = clientReturning({
				error: { message: 'Not valid.', code },
			})
			await expect(
				supabaseBetaApi(client).redeemInvite('x'),
			).rejects.toBeInstanceOf(BetaInviteRefused)
		},
	)

	it('does not treat other errors as a refusal', async () => {
		const { client } = clientReturning({
			error: { message: 'Timed out', code: '57014' },
		})
		const failure = supabaseBetaApi(client).redeemInvite('x')
		await expect(failure).rejects.toThrow('Timed out')
		await expect(failure).rejects.not.toBeInstanceOf(BetaInviteRefused)
	})
})

describe('recordDevice', () => {
	const device = {
		browser: 'Safari 17',
		os: 'iOS 17.4',
		viewport: '390x664',
		screen: '390x844',
		pixelRatio: 3,
		touch: true,
		installed: false,
		language: 'en-US',
		userAgent: 'agent',
	}

	it('sends the device with the round', async () => {
		const { rpc, client } = clientReturning({ data: null })
		await supabaseBetaApi(client).recordDevice('round-1', device)
		expect(rpc).toHaveBeenCalledWith('record_beta_device', {
			p_round: 'round-1',
			p_device: device,
		})
	})

	it('fails when the database refuses it', async () => {
		const { client } = clientReturning({
			error: { message: 'not open', code: '22023' },
		})
		await expect(
			supabaseBetaApi(client).recordDevice('round-1', device),
		).rejects.toThrow('not open')
	})
})
