import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { isRow, rows, text, time, type Row } from './readRow'

export interface BetaAnnouncement {
	readonly id: string
	readonly title: string
	readonly body: string
	readonly pinned: boolean
	readonly publishedAt: number
}

// Times are milliseconds since the epoch.
export interface BetaRound {
	readonly id: string
	readonly name: string
	readonly startsAt: number
	readonly endsAt: number
	readonly welcome: string
	readonly instructions: string
	readonly surveyVersion: number
	readonly surveySubmitted: boolean
	readonly announcements: readonly BetaAnnouncement[]
}

export interface BetaDashboardData {
	// The server's clock when this was read, so a countdown does not depend on the device's.
	readonly serverNow: number
	// An admin previewing the page, who is not a tester and cannot send anything.
	readonly preview: boolean
	// Newest round first.
	readonly rounds: readonly BetaRound[]
}

// The server turned an invite down (not valid, used, ended, or revoked), so trying it
// again would not help; its message is written for the person.
export class BetaInviteRefused extends Error {}

export interface BetaApi {
	readonly loadDashboard: () => Promise<BetaDashboardData>
	readonly redeemInvite: (token: string) => Promise<void>
}

function parseAnnouncement(row: Row): BetaAnnouncement {
	return {
		id: text(row, 'id'),
		title: text(row, 'title'),
		body: text(row, 'body'),
		pinned: row.pinned === true,
		publishedAt: time(row, 'published_at'),
	}
}

function parseRound(row: Row): BetaRound {
	const surveyVersion = row.survey_version
	if (typeof surveyVersion !== 'number')
		throw new Error('Missing survey_version.')
	return {
		id: text(row, 'id'),
		name: text(row, 'name'),
		startsAt: time(row, 'starts_at'),
		endsAt: time(row, 'ends_at'),
		welcome: text(row, 'welcome'),
		instructions: text(row, 'instructions'),
		surveyVersion,
		surveySubmitted: row.survey_submitted === true,
		announcements: rows(row.announcements).map(parseAnnouncement),
	}
}

export function parseDashboard(value: unknown): BetaDashboardData {
	if (!isRow(value)) throw new Error('Unexpected beta data.')
	return {
		serverNow: time(value, 'now'),
		preview: value.preview === true,
		rounds: rows(value.rounds).map(parseRound),
	}
}

// Database errors the person can act on, rather than a transport failure.
const REFUSAL_CODES = new Set(['22023', '42501'])

export function supabaseBetaApi(client: SupabaseClient<Database>): BetaApi {
	return {
		async loadDashboard() {
			const { data, error } = await client.rpc('beta_dashboard')
			if (error) throw new Error(error.message)
			return parseDashboard(data)
		},
		async redeemInvite(token) {
			const { error } = await client.rpc('redeem_beta_invite', {
				p_token: token,
			})
			if (!error) return
			if (REFUSAL_CODES.has(error.code))
				throw new BetaInviteRefused(error.message)
			throw new Error(error.message)
		},
	}
}
