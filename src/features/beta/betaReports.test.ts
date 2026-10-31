import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/supabase'
import { supabaseReportApi } from './betaReports'
import type { DeviceInfo } from './deviceInfo'

const device: DeviceInfo = {
	browser: 'Safari 17',
	os: 'iOS 17.4',
	viewport: '390 × 664',
	screen: '390 × 844',
	pixelRatio: 3,
	touch: true,
	installed: false,
	language: 'en-US',
	userAgent: 'agent',
}

function fakeClient({
	rpcError = null,
	uploadError = null,
	history = { data: [], error: null },
}: {
	rpcError?: { message: string } | null
	uploadError?: object | null
	history?: { data: unknown; error: { message: string } | null }
} = {}) {
	const order = vi.fn().mockResolvedValue(history)
	const eq = vi.fn(() => ({ order }))
	const select = vi.fn(() => ({ eq }))
	const fromTable = vi.fn(() => ({ select }))
	const upload = vi.fn().mockResolvedValue({ error: uploadError })
	const remove = vi.fn().mockResolvedValue({ error: null })
	const from = vi.fn(() => ({ upload, remove }))
	const rpc = vi.fn().mockResolvedValue({ data: 'id', error: rpcError })
	return {
		upload,
		remove,
		from,
		rpc,
		fromTable,
		eq,
		order,
		client: {
			rpc,
			from: fromTable,
			storage: { from },
		} as unknown as SupabaseClient<Database>,
	}
}

describe('supabaseReportApi', () => {
	it('uploads to the private screenshot bucket with the file type', async () => {
		const { client, from, upload } = fakeClient()
		const file = new Blob(['x'], { type: 'image/png' })
		await supabaseReportApi(client).upload('user/report/a.png', file)
		expect(from).toHaveBeenCalledWith('beta-screenshots')
		expect(upload).toHaveBeenCalledWith('user/report/a.png', file, {
			contentType: 'image/png',
		})
	})

	it('says plainly when an upload fails', async () => {
		const { client } = fakeClient({ uploadError: { message: 'policy' } })
		await expect(
			supabaseReportApi(client).upload('p', new Blob(['x'])),
		).rejects.toThrow('A screenshot could not be uploaded.')
	})

	it('removes uploads by path', async () => {
		const { client, remove } = fakeClient()
		await supabaseReportApi(client).remove(['a', 'b'])
		expect(remove).toHaveBeenCalledWith(['a', 'b'])
	})

	it('sends a bug report with only the bug fields', async () => {
		const { client, rpc } = fakeClient()
		await supabaseReportApi(client).submit({
			kind: 'bug',
			id: 'r1',
			roundId: 'round',
			steps: 'steps',
			expected: 'expected',
			happened: 'happened',
			device,
			images: ['a'],
		})
		expect(rpc).toHaveBeenCalledWith('submit_beta_report', {
			p_id: 'r1',
			p_round: 'round',
			p_kind: 'bug',
			p_images: ['a'],
			p_steps: 'steps',
			p_expected: 'expected',
			p_happened: 'happened',
			p_device: device,
		})
	})

	it('sends a suggestion with only the suggestion fields', async () => {
		const { client, rpc } = fakeClient()
		await supabaseReportApi(client).submit({
			kind: 'suggestion',
			id: 'r2',
			roundId: 'round',
			feature: 'Shapes',
			details: 'More',
			images: [],
		})
		expect(rpc).toHaveBeenCalledWith('submit_beta_report', {
			p_id: 'r2',
			p_round: 'round',
			p_kind: 'suggestion',
			p_images: [],
			p_feature: 'Shapes',
			p_details: 'More',
		})
	})

	it("passes on the database's message when a report is refused", async () => {
		const { client } = fakeClient({
			rpcError: { message: 'That is a lot of reports for one day.' },
		})
		await expect(
			supabaseReportApi(client).submit({
				kind: 'suggestion',
				id: 'r3',
				roundId: 'round',
				feature: 'Shapes',
				details: 'More',
				images: [],
			}),
		).rejects.toThrow('That is a lot of reports for one day.')
	})

	describe('loadHistory', () => {
		const row = {
			id: 'r1',
			kind: 'bug',
			status: 'investigating',
			admin_note: 'Looking into it',
			created_at: '2026-10-31T12:00:00Z',
			steps: 's',
			expected: 'e',
			happened: 'h',
			feature: null,
			details: null,
			beta_report_images: [{ path: 'a' }, { path: 'b' }],
		}

		it('reads only the named tester’s reports, newest first', async () => {
			const { client, fromTable, eq, order } = fakeClient({
				history: { data: [row], error: null },
			})
			const [report] =
				await supabaseReportApi(client).loadHistory('user-1')
			expect(fromTable).toHaveBeenCalledWith('beta_reports')
			expect(eq).toHaveBeenCalledWith('user_id', 'user-1')
			expect(order).toHaveBeenCalledWith('created_at', {
				ascending: false,
			})
			expect(report).toEqual({
				id: 'r1',
				kind: 'bug',
				status: 'investigating',
				adminNote: 'Looking into it',
				createdAt: Date.parse('2026-10-31T12:00:00Z'),
				steps: 's',
				expected: 'e',
				happened: 'h',
				feature: null,
				details: null,
				screenshotCount: 2,
			})
		})

		it('fails when the reports cannot be read', async () => {
			const { client } = fakeClient({
				history: { data: null, error: { message: 'down' } },
			})
			await expect(
				supabaseReportApi(client).loadHistory('u'),
			).rejects.toThrow('down')
		})

		it.each([
			['an unknown kind', { ...row, kind: 'praise' }],
			['an unknown status', { ...row, status: 'closed' }],
			['a bad time', { ...row, created_at: 'soon' }],
			['no list of screenshots', { ...row, beta_report_images: null }],
		])('refuses a report with %s', async (_label, bad) => {
			const { client } = fakeClient({
				history: { data: [bad], error: null },
			})
			await expect(
				supabaseReportApi(client).loadHistory('u'),
			).rejects.toThrow()
		})
	})
})
