import { Button, Heading, Modal, ModalHeader } from '@/ui/components'
import { faPollPeople } from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useId, useState } from 'react'
import type { ReportApi } from './betaReports'
import type { Survey } from './survey'
import SurveyForm from './SurveyForm'
import styles from './SurveyPanel.module.css'

// The final survey, for a tester to send once they are done. A survey already sent shows only
// a thank-you. The form is kept while its dialog is closed, so nothing written is lost.
export default function SurveyPanel({
	survey,
	roundId,
	api,
	alreadySent,
}: {
	readonly survey: Survey
	readonly roundId: string
	readonly api: ReportApi
	readonly alreadySent: boolean
}) {
	const titleId = useId()
	const [open, setOpen] = useState(false)
	const [sent, setSent] = useState(alreadySent)
	const close = () => setOpen(false)

	return (
		<section className={styles.panel} aria-label="Final survey">
			<Heading level={3} className={styles.heading}>
				<FontAwesomeIcon icon={faPollPeople} aria-hidden="true" /> Final
				Survey
			</Heading>
			{sent ? (
				<p className={styles.text} role="status">
					Thank you! Your survey was sent.
				</p>
			) : (
				<>
					<p className={styles.text}>
						When you are done testing, tell us what you think. You
						can send the survey only once.
					</p>
					<div className={styles.buttons}>
						<Button
							variant="primary"
							aria-haspopup="dialog"
							onClick={() => setOpen(true)}
						>
							Take the Survey
						</Button>
					</div>
				</>
			)}
			{/* Kept in place after sending, so the dialog can finish closing. */}
			{!alreadySent && (
				<Modal
					open={open}
					onClose={close}
					labelledBy={titleId}
					className={styles.dialog}
					header={
						<ModalHeader
							title="Final Survey"
							titleId={titleId}
							closeLabel="Close Final Survey"
							onClose={close}
						/>
					}
				>
					<SurveyForm
						survey={survey}
						roundId={roundId}
						api={api}
						onSent={() => {
							setSent(true)
							close()
						}}
					/>
				</Modal>
			)}
		</section>
	)
}
