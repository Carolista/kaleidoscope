import { useEffect, useState } from 'react'
import { Button, Loading } from '@/ui/components'
import type {
	ReportApi,
	ReportKind,
	ReportRecord,
	ReportStatus,
} from './betaReports'
import styles from './ReportHistory.module.css'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'short' })

const KIND_LABELS: Record<ReportKind, string> = {
	bug: 'Bug Report',
	suggestion: 'Suggestion',
	other: 'Feedback',
}
const STATUS_LABELS: Record<ReportStatus, string> = {
	new: 'Received',
	investigating: 'Investigating',
	resolved: 'Resolved',
}

type State =
	| { readonly status: 'loading' }
	| { readonly status: 'failed' }
	| { readonly status: 'ready'; readonly reports: readonly ReportRecord[] }

// What the tester wrote, in the words of the question it answered.
function sentFields(report: ReportRecord) {
	const fields: [string, string | null][] =
		report.kind === 'bug'
			? [
					['What I expected', report.expected],
					['What happened instead', report.happened],
					['Steps to reproduce', report.steps],
				]
			: [
					['Category', report.feature],
					['My suggestion', report.details],
				]
	return fields.filter(
		(field): field is [string, string] => field[1] !== null,
	)
}

function ReportItem({ report }: { readonly report: ReportRecord }) {
	return (
		<li className={styles.item}>
			<div className={styles.row}>
				<strong>{KIND_LABELS[report.kind]}</strong>
				<span className={styles.date}>
					{dateFormat.format(report.createdAt)}
				</span>
				<span className={styles.status} data-status={report.status}>
					{STATUS_LABELS[report.status]}
				</span>
			</div>
			{report.adminNote && (
				<p className={styles.reply}>
					<strong>Reply:</strong> {report.adminNote}
				</p>
			)}
			<details className={styles.sent}>
				<summary>What I sent</summary>
				<dl className={styles.fields}>
					{sentFields(report).map(([label, value]) => (
						<div key={label}>
							<dt>{label}</dt>
							<dd>{value}</dd>
						</div>
					))}
				</dl>
				{report.screenshotCount > 0 && (
					<p className={styles.screenshots}>
						{report.screenshotCount === 1
							? '1 screenshot attached'
							: `${report.screenshotCount} screenshots attached`}
					</p>
				)}
			</details>
		</li>
	)
}

// The tester's own reports with where each stands. It reads when it appears, so it is shown
// anew (with a new `key`) each time it is opened.
export default function ReportHistory({
	api,
	userId,
}: {
	readonly api: ReportApi
	readonly userId: string
}) {
	const [state, setState] = useState<State>({ status: 'loading' })
	const [attempt, setAttempt] = useState(0)

	useEffect(() => {
		let cancelled = false
		api.loadHistory(userId).then(
			reports => {
				if (!cancelled) setState({ status: 'ready', reports })
			},
			() => {
				if (!cancelled) setState({ status: 'failed' })
			},
		)
		return () => {
			cancelled = true
		}
	}, [api, userId, attempt])

	if (state.status === 'loading')
		return <Loading label="Loading your history…" />
	if (state.status === 'failed')
		return (
			<div className={styles.message}>
				<p role="alert">Your history could not be loaded.</p>
				<Button
					onClick={() => {
						setState({ status: 'loading' })
						setAttempt(count => count + 1)
					}}
				>
					Try again
				</Button>
			</div>
		)
	if (state.reports.length === 0)
		return (
			<p className={styles.message}>
				You have not sent any feedback yet. Thank you in advance!
			</p>
		)
	return (
		<ul className={styles.list} aria-label="Your feedback">
			{state.reports.map(report => (
				<ReportItem key={report.id} report={report} />
			))}
		</ul>
	)
}
