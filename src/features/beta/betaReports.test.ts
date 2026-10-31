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
}: {
	rpcError?: { message: string } | null
	uploadError?: object | null
} = {}) {
	const upload = vi.fn().mockResolvedValue({ error: uploadError })
	const remove = vi.fn().mockResolvedValue({ error: null })
	const from = vi.fn(() => ({ upload, remove }))
	const rpc = vi.fn().mockResolvedValue({ data: 'id', error: rpcError })
	return {
		upload,
		remove,
		from,
		rpc,
		client: {
			rpc,
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
})
