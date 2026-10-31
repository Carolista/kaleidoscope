import { Button, FormField, Select, Textarea } from '@/ui/components'
import { useState, type SubmitEvent } from 'react'
import type { ReportApi } from './betaReports'
import styles from './ReportForm.module.css'
import { SUGGESTION_CATEGORIES } from './suggestionCategories'

// An idea for the app, filed under the part of it that it is about.
export default function SuggestionForm({
	roundId,
	api,
	onSent,
}: {
	readonly roundId: string
	readonly api: ReportApi
	readonly onSent: () => void
}) {
	const [reportId] = useState(() => crypto.randomUUID())
	const [pending, setPending] = useState(false)
	const [error, setError] = useState('')

	async function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		const values = new FormData(event.currentTarget)
		const feature = String(values.get('category') ?? '')
		const details = String(values.get('details') ?? '').trim()
		if (!feature || !details) {
			setError('Please choose a category and write your suggestion.')
			return
		}
		setError('')
		setPending(true)
		try {
			await api.submit({
				kind: 'suggestion',
				id: reportId,
				roundId,
				feature,
				details,
				images: [],
			})
			onSent()
		} catch (failure) {
			setError(
				failure instanceof Error
					? failure.message
					: 'Your suggestion could not be sent. Please try again.',
			)
			setPending(false)
		}
	}

	return (
		<form
			className={styles.form}
			aria-label="Make a suggestion"
			onSubmit={event => void submit(event)}
		>
			<FormField label="Category">
				{field => (
					<Select
						{...field}
						name="category"
						defaultValue=""
						required
						disabled={pending}
					>
						<option value="" disabled>
							Choose one…
						</option>
						{SUGGESTION_CATEGORIES.map(category => (
							<option key={category} value={category}>
								{category}
							</option>
						))}
					</Select>
				)}
			</FormField>
			<FormField label="Your suggestion">
				{field => (
					<Textarea
						{...field}
						name="details"
						required
						maxLength={4000}
						disabled={pending}
					/>
				)}
			</FormField>
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
