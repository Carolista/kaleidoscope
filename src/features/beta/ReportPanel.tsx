import { useEffect, useId, useState, type ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
	faBug,
	faClockRotateLeft,
	faLightbulbOn,
} from '@fortawesome/pro-solid-svg-icons'
import { Button, Heading, Modal, ModalHeader } from '@/ui/components'
import { bands } from './bands'
import type { ReportApi } from './betaReports'
import BugReportForm from './BugReportForm'
import ReportHistory from './ReportHistory'
import SuggestionForm from './SuggestionForm'
import styles from './ReportPanel.module.css'

type Dialog = 'bug' | 'suggestion' | 'history'

const ACTIONS: readonly {
	readonly dialog: Dialog
	readonly label: string
	readonly icon: IconDefinition
	// The palette whose colors fill the button.
	readonly paletteId: string
	readonly reversed?: boolean
}[] = [
	{
		dialog: 'bug',
		label: 'Report a Bug',
		icon: faBug,
		paletteId: '060d8a6b-d371-4dd8-a88e-0e767b6156d6',
		// This palette runs dark to light; the others run light to dark.
		reversed: true,
	},
	{
		dialog: 'suggestion',
		label: 'Make a Suggestion',
		icon: faLightbulbOn,
		paletteId: '3e91c233-0e39-41fe-b9e7-ac4e25815568',
	},
	{
		dialog: 'history',
		label: 'View History',
		icon: faClockRotateLeft,
		paletteId: 'a948fcf6-e4ab-43c2-811e-c2de43ca732d',
	},
]
const PALETTE_IDS = ACTIONS.map(action => action.paletteId)

// A form's dialog shows its form, or a thank-you once it has been sent. The form is kept
// while the dialog is closed, so closing it by accident does not lose what was written.
function FormDialog({
	open,
	onClose,
	title,
	thanks,
	another,
	children,
}: {
	readonly open: boolean
	readonly onClose: () => void
	readonly title: string
	readonly thanks: string
	readonly another: string
	// Given what to do once the form is sent.
	readonly children: (onSent: () => void) => ReactNode
}) {
	const titleId = useId()
	const [sent, setSent] = useState(false)
	// A form that has been sent comes back empty, as a new one.
	const [fresh, setFresh] = useState(0)
	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy={titleId}
			className={styles.dialog}
			header={
				<ModalHeader
					title={title}
					titleId={titleId}
					closeLabel={`Close ${title}`}
					onClose={onClose}
				/>
			}
		>
			{sent ? (
				<div className={styles.thanks}>
					<p role="status">{thanks}</p>
					<div className={styles.thanksButtons}>
						<Button
							onClick={() => {
								setSent(false)
								setFresh(count => count + 1)
							}}
						>
							{another}
						</Button>
						<Button variant="primary" onClick={onClose}>
							Close
						</Button>
					</div>
				</div>
			) : (
				<div key={fresh}>{children(() => setSent(true))}</div>
			)}
		</Modal>
	)
}

// Where a tester sends feedback: three buttons, each opening a dialog for a bug report, a
// suggestion, or the history of what they have sent.
export default function ReportPanel({
	roundId,
	userId,
	api,
	prepare,
}: {
	readonly roundId: string
	readonly userId: string
	readonly api: ReportApi
	readonly prepare?: (file: Blob) => Promise<Blob>
}) {
	const historyTitleId = useId()
	const [open, setOpen] = useState<Dialog | null>(null)
	// Counts the openings of the history, which reads again each time.
	const [historyOpenings, setHistoryOpenings] = useState(0)
	// Only decoration, so the buttons are plain until the colors arrive, or if they never do.
	const [palettes, setPalettes] = useState<Record<string, readonly string[]>>(
		{},
	)
	useEffect(() => {
		let cancelled = false
		api.loadPalettes(PALETTE_IDS).then(
			loaded => {
				if (!cancelled) setPalettes(loaded)
			},
			() => undefined,
		)
		return () => {
			cancelled = true
		}
	}, [api])
	const close = () => setOpen(null)

	return (
		<section className={styles.panel} aria-label="Submit feedback">
			<Heading level={3} className={styles.heading}>
				Submit Feedback
			</Heading>
			<div className={styles.actions}>
				{ACTIONS.map(action => {
					const colors = palettes[action.paletteId]
					return (
						<button
							key={action.dialog}
							type="button"
							className={styles.action}
							style={
								colors
									? {
											background: bands(
												action.reversed
													? [...colors].reverse()
													: colors,
											),
										}
									: undefined
							}
							data-banded={colors ? '' : undefined}
							aria-haspopup="dialog"
							onClick={() => {
								if (action.dialog === 'history')
									setHistoryOpenings(count => count + 1)
								setOpen(action.dialog)
							}}
						>
							<FontAwesomeIcon
								icon={action.icon}
								size="xl"
								aria-hidden="true"
							/>
							<span>{action.label}</span>
						</button>
					)
				})}
			</div>
			<FormDialog
				open={open === 'bug'}
				onClose={close}
				title="Report a Bug"
				thanks="Thank you! Your bug report was sent."
				another="Report Another Bug"
			>
				{onSent => (
					<BugReportForm
						roundId={roundId}
						userId={userId}
						api={api}
						prepare={prepare}
						onSent={onSent}
					/>
				)}
			</FormDialog>
			<FormDialog
				open={open === 'suggestion'}
				onClose={close}
				title="Make a Suggestion"
				thanks="Thank you! Your suggestion was sent."
				another="Make Another Suggestion"
			>
				{onSent => (
					<SuggestionForm
						roundId={roundId}
						api={api}
						onSent={onSent}
					/>
				)}
			</FormDialog>
			<Modal
				open={open === 'history'}
				onClose={close}
				labelledBy={historyTitleId}
				className={styles.dialog}
				header={
					<ModalHeader
						title="View History"
						titleId={historyTitleId}
						closeLabel="Close View History"
						onClose={close}
					/>
				}
			>
				{historyOpenings > 0 && (
					<ReportHistory
						key={historyOpenings}
						api={api}
						userId={userId}
					/>
				)}
			</Modal>
		</section>
	)
}
