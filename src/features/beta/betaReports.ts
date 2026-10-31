import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import type { DeviceInfo } from './deviceInfo'

const BUCKET = 'beta-screenshots'

interface ReportBase {
	// Chosen by the app before anything is uploaded, so screenshots can be stored under it.
	readonly id: string
	readonly roundId: string
	// Paths of screenshots already uploaded for this report.
	readonly images: readonly string[]
}

export type NewReport = ReportBase &
	(
		| {
				readonly kind: 'bug'
				readonly steps: string
				readonly expected: string
				readonly happened: string
				readonly device: DeviceInfo
		  }
		| {
				readonly kind: 'suggestion'
				readonly feature: string
				readonly details: string
		  }
	)

export interface ReportApi {
	readonly upload: (path: string, file: Blob) => Promise<void>
	// Clears away uploads that will not be sent. Failing to is not worth reporting.
	readonly remove: (paths: readonly string[]) => Promise<void>
	readonly submit: (report: NewReport) => Promise<void>
}

export function supabaseReportApi(client: SupabaseClient<Database>): ReportApi {
	return {
		async upload(path, file) {
			const { error } = await client.storage
				.from(BUCKET)
				.upload(path, file, { contentType: file.type })
			if (error) throw new Error('A screenshot could not be uploaded.')
		},
		async remove(paths) {
			await client.storage.from(BUCKET).remove([...paths])
		},
		async submit(report) {
			const shared = {
				p_id: report.id,
				p_round: report.roundId,
				p_kind: report.kind,
				p_images: [...report.images],
			}
			const { error } = await client.rpc(
				'submit_beta_report',
				report.kind === 'bug'
					? {
							...shared,
							p_steps: report.steps,
							p_expected: report.expected,
							p_happened: report.happened,
							p_device: report.device,
						}
					: {
							...shared,
							p_feature: report.feature,
							p_details: report.details,
						},
			)
			// The database's messages are written to be read by the tester.
			if (error) throw new Error(error.message)
		},
	}
}
