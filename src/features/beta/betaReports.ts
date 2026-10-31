import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import type { DeviceInfo } from './deviceInfo'
import { optionalText, rows, text, time } from './readRow'

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

export type ReportStatus = 'new' | 'investigating' | 'resolved'
export type ReportKind = 'bug' | 'suggestion' | 'other'

// A report the tester sent, as they see it afterwards.
export interface ReportRecord {
	readonly id: string
	readonly kind: ReportKind
	readonly status: ReportStatus
	// A short reply from the admin, written for the tester.
	readonly adminNote: string | null
	readonly createdAt: number
	readonly steps: string | null
	readonly expected: string | null
	readonly happened: string | null
	readonly feature: string | null
	readonly details: string | null
	readonly screenshotCount: number
}

export interface ReportApi {
	readonly upload: (path: string, file: Blob) => Promise<void>
	// Clears away uploads that will not be sent. Failing to is not worth reporting.
	readonly remove: (paths: readonly string[]) => Promise<void>
	readonly submit: (report: NewReport) => Promise<void>
	// The tester's own reports, newest first.
	readonly loadHistory: (userId: string) => Promise<ReportRecord[]>
}

const KINDS: readonly string[] = ['bug', 'suggestion', 'other']
const STATUSES: readonly string[] = ['new', 'investigating', 'resolved']

function parseRecord(row: Record<string, unknown>): ReportRecord {
	const kind = text(row, 'kind')
	const status = text(row, 'status')
	if (!KINDS.includes(kind) || !STATUSES.includes(status))
		throw new Error('Unexpected report.')
	return {
		id: text(row, 'id'),
		kind: kind as ReportKind,
		status: status as ReportStatus,
		adminNote: optionalText(row, 'admin_note'),
		createdAt: time(row, 'created_at'),
		steps: optionalText(row, 'steps'),
		expected: optionalText(row, 'expected'),
		happened: optionalText(row, 'happened'),
		feature: optionalText(row, 'feature'),
		details: optionalText(row, 'details'),
		screenshotCount: rows(row.beta_report_images).length,
	}
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
		async loadHistory(userId) {
			// Named, because an admin's session can read every tester's reports.
			const { data, error } = await client
				.from('beta_reports')
				.select(
					'id, kind, status, admin_note, created_at, steps, expected, happened, feature, details, beta_report_images(path)',
				)
				.eq('user_id', userId)
				.order('created_at', { ascending: false })
			if (error) throw new Error(error.message)
			return rows(data).map(parseRecord)
		},
	}
}
