import { Button, FormField, Textarea } from '@/ui/components'
import { useRef, useState, type SubmitEvent } from 'react'
import type { NewReport, ReportApi } from './betaReports'
import { deviceSummary } from './deviceInfo'
import styles from './ReportForm.module.css'
import ScreenshotPicker, { type Attachment } from './ScreenshotPicker'
import { prepareScreenshot, screenshotExtension } from './screenshots'
import useDeviceInfo from './useDeviceInfo'

// What the tester was doing and what went wrong, with the device's details and screenshots.
// Screenshots are uploaded when the report is sent, and the report goes only once every one
// has arrived. A report that fails part-way can be sent again without uploading twice.
export default function BugReportForm({
	roundId,
	userId,
	api,
	onSent,
	prepare = prepareScreenshot,
}: {
	readonly roundId: string
	readonly userId: string
	readonly api: ReportApi
	readonly onSent: () => void
	// Shrinks a screenshot for sending; replaceable for tests.
	readonly prepare?: (file: Blob) => Promise<Blob>
}) {
	const device = useDeviceInfo()
	const [reportId] = useState(() => crypto.randomUUID())
	const [attachments, setAttachments] = useState<readonly Attachment[]>([])
	const [pending, setPending] = useState(false)
	const [error, setError] = useState('')
	// Where each attachment went, so sending again does not upload it again.
	const uploaded = useRef(new Map<string, string>())

	function changeAttachments(next: readonly Attachment[]) {
		const kept = new Set(next.map(attachment => attachment.id))
		const removed = attachments
			.filter(attachment => !kept.has(attachment.id))
			.flatMap(attachment => uploaded.current.get(attachment.id) ?? [])
		for (const attachment of attachments)
			if (!kept.has(attachment.id)) uploaded.current.delete(attachment.id)
		if (removed.length > 0) void api.remove(removed).catch(() => undefined)
		setAttachments(next)
	}

	async function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		const values = new FormData(event.currentTarget)
		const answer = (name: string) => String(values.get(name) ?? '').trim()
		const steps = answer('steps')
		const expected = answer('expected')
		const happened = answer('happened')
		if (!steps || !expected || !happened) {
			setError('Please answer each of the questions.')
			return
		}
		setError('')
		setPending(true)
		try {
			const images: string[] = []
			for (const attachment of attachments) {
				let path = uploaded.current.get(attachment.id)
				if (!path) {
					const file = await prepare(attachment.file)
					path = `${userId}/${reportId}/${crypto.randomUUID()}.${screenshotExtension(file.type)}`
					await api.upload(path, file)
					uploaded.current.set(attachment.id, path)
				}
				images.push(path)
			}
			const report: NewReport = {
				kind: 'bug',
				id: reportId,
				roundId,
				steps,
				expected,
				happened,
				device,
				images,
			}
			await api.submit(report)
			onSent()
		} catch (failure) {
			setError(
				failure instanceof Error
					? failure.message
					: 'Your report could not be sent. Please try again.',
			)
			setPending(false)
		}
	}

	return (
		<form
			className={styles.form}
			aria-label="Report a bug"
			onSubmit={event => void submit(event)}
		>
			<FormField label="What did you expect to happen?">
				{field => (
					<Textarea
						{...field}
						name="expected"
						required
						maxLength={2000}
						disabled={pending}
					/>
				)}
			</FormField>
			<FormField label="What happened instead?">
				{field => (
					<Textarea
						{...field}
						name="happened"
						required
						maxLength={2000}
						disabled={pending}
					/>
				)}
			</FormField>
			<FormField label="What steps should we take to reproduce the issue?">
				{field => (
					<Textarea
						{...field}
						name="steps"
						required
						maxLength={2000}
						disabled={pending}
					/>
				)}
			</FormField>
			<section className={styles.device} aria-label="Your device">
				<dl className={styles.deviceList}>
					{deviceSummary(device).map(line => (
						<div key={line.label} className={styles.deviceItem}>
							<dt>{line.label}</dt>
							<dd>{line.value}</dd>
						</div>
					))}
				</dl>
			</section>
			<fieldset className={styles.screenshots} disabled={pending}>
				<legend>SCREENSHOTS (optional)</legend>
				<ScreenshotPicker
					value={attachments}
					onChange={changeAttachments}
					disabled={pending}
				/>
			</fieldset>
			{error && (
				<p className={styles.error} role="alert">
					{error}
				</p>
			)}
			<div className={styles.buttons}>
				<Button type="submit" variant="primary" disabled={pending}>
					{pending ? 'Submitting…' : 'Submit'}
				</Button>
			</div>
		</form>
	)
}
