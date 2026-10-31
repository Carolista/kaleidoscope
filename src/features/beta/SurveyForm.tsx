import { useState, type SubmitEvent } from 'react'
import { Button, FormField, Textarea } from '@/ui/components'
import type { ReportApi } from './betaReports'
import type { Survey, SurveyAnswers } from './survey'
import styles from './SurveyForm.module.css'

// The final survey. Questions that were left blank are not sent, and a required one must be
// answered; the survey can be sent once, so it asks for no more than that.
export default function SurveyForm({
	survey,
	roundId,
	api,
	onSent,
}: {
	readonly survey: Survey
	readonly roundId: string
	readonly api: ReportApi
	readonly onSent: () => void
}) {
	const [pending, setPending] = useState(false)
	const [error, setError] = useState('')

	async function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		const values = new FormData(event.currentTarget)
		const answers: Record<string, string> = {}
		for (const question of survey.questions) {
			const answer = String(values.get(question.id) ?? '').trim()
			if (answer) answers[question.id] = answer
		}
		if (survey.questions.some(q => q.required && !answers[q.id])) {
			setError('Please answer the questions marked as required.')
			return
		}
		setError('')
		setPending(true)
		try {
			await api.submitSurvey(roundId, answers satisfies SurveyAnswers)
			onSent()
		} catch (failure) {
			setError(
				failure instanceof Error
					? failure.message
					: 'Your survey could not be sent. Please try again.',
			)
			setPending(false)
		}
	}

	return (
		<form
			className={styles.form}
			aria-label="Final survey"
			onSubmit={event => void submit(event)}
		>
			<p className={styles.intro}>{survey.intro}</p>
			{survey.questions.map(question =>
				question.kind === 'choice' ? (
					<fieldset
						key={question.id}
						className={styles.choices}
						disabled={pending}
					>
						<legend>
							{question.label}
							{question.required && (
								<span className={styles.required}>
									{' '}
									(required)
								</span>
							)}
						</legend>
						{question.options.map((option, index) => (
							<label key={option.value} className={styles.choice}>
								<input
									type="radio"
									name={question.id}
									value={option.value}
									required={question.required && index === 0}
								/>
								{option.label}
							</label>
						))}
					</fieldset>
				) : (
					<FormField
						key={question.id}
						label={
							<>
								{question.label}
								{!question.required && (
									<span className={styles.optional}>
										{' '}
										(optional)
									</span>
								)}
							</>
						}
					>
						{field => (
							<Textarea
								{...field}
								name={question.id}
								required={question.required}
								maxLength={2000}
								disabled={pending}
							/>
						)}
					</FormField>
				),
			)}
			{error && (
				<p className={styles.error} role="alert">
					{error}
				</p>
			)}
			<div className={styles.buttons}>
				<Button type="submit" variant="primary" disabled={pending}>
					{pending ? 'Sending…' : 'Send Survey'}
				</Button>
			</div>
		</form>
	)
}
