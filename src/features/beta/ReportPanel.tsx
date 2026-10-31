import { Button, Heading } from '@/ui/components'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import type { ReportApi } from './betaReports'
import BugReportForm from './BugReportForm'
import styles from './ReportPanel.module.css'
import SuggestionForm from './SuggestionForm'

type Kind = 'bug' | 'suggestion'

const TABS: readonly {
	readonly kind: Kind
	readonly label: string
	readonly thanks: string
}[] = [
	{
		kind: 'bug',
		label: 'Report a Bug',
		thanks: 'Thank you! Your bug report was sent.',
	},
	{
		kind: 'suggestion',
		label: 'Make a Suggestion',
		thanks: 'Thank you! Your suggestion was sent.',
	},
]

// Where a tester sends feedback: a bug report or a suggestion, one tab each. Both forms stay
// in place while the other tab is showing, so nothing typed is lost by looking at the other.
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
	const idPrefix = useId()
	const tabRefs = useRef<Record<Kind, HTMLButtonElement | null>>({
		bug: null,
		suggestion: null,
	})
	const [active, setActive] = useState<Kind>('bug')
	const [sent, setSent] = useState<Record<Kind, boolean>>({
		bug: false,
		suggestion: false,
	})
	// A form that has been sent comes back empty, as a new one.
	const [fresh, setFresh] = useState<Record<Kind, number>>({
		bug: 0,
		suggestion: 0,
	})

	function moveTab(event: KeyboardEvent<HTMLButtonElement>) {
		const current = TABS.findIndex(tab => tab.kind === active)
		const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 }
		let next: number
		if (event.key in step)
			next = (current + step[event.key] + TABS.length) % TABS.length
		else if (event.key === 'Home') next = 0
		else if (event.key === 'End') next = TABS.length - 1
		else return
		event.preventDefault()
		setActive(TABS[next].kind)
		tabRefs.current[TABS[next].kind]?.focus()
	}

	return (
		<section className={styles.panel} aria-label="Send feedback">
			<Heading level={3} className={styles.heading}>
				Submit Feedback
			</Heading>
			<div
				className={styles.tabs}
				role="tablist"
				aria-label="Kind of feedback"
			>
				{TABS.map(tab => (
					<button
						key={tab.kind}
						ref={element => {
							tabRefs.current[tab.kind] = element
						}}
						type="button"
						role="tab"
						id={`${idPrefix}-${tab.kind}-tab`}
						aria-selected={active === tab.kind}
						aria-controls={`${idPrefix}-${tab.kind}-panel`}
						tabIndex={active === tab.kind ? 0 : -1}
						className={styles.tab}
						onClick={() => setActive(tab.kind)}
						onKeyDown={moveTab}
					>
						{tab.label}
					</button>
				))}
			</div>
			{TABS.map(tab => (
				<div
					key={tab.kind}
					role="tabpanel"
					id={`${idPrefix}-${tab.kind}-panel`}
					aria-labelledby={`${idPrefix}-${tab.kind}-tab`}
					hidden={active !== tab.kind}
					className={styles.tabPanel}
				>
					{sent[tab.kind] ? (
						<div className={styles.thanks}>
							<p role="status">{tab.thanks}</p>
							<Button
								onClick={() => {
									setSent(previous => ({
										...previous,
										[tab.kind]: false,
									}))
									setFresh(previous => ({
										...previous,
										[tab.kind]: previous[tab.kind] + 1,
									}))
								}}
							>
								{tab.kind === 'bug'
									? 'Report Another Bug'
									: 'Make Another Suggestion'}
							</Button>
						</div>
					) : tab.kind === 'bug' ? (
						<BugReportForm
							key={fresh.bug}
							roundId={roundId}
							userId={userId}
							api={api}
							prepare={prepare}
							onSent={() =>
								setSent(previous => ({
									...previous,
									bug: true,
								}))
							}
						/>
					) : (
						<SuggestionForm
							key={fresh.suggestion}
							roundId={roundId}
							api={api}
							onSent={() =>
								setSent(previous => ({
									...previous,
									suggestion: true,
								}))
							}
						/>
					)}
				</div>
			))}
		</section>
	)
}
