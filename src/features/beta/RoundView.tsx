import { Heading } from '@/ui/components'
import {
	faArrowUpRightFromSquare,
	faThumbtack,
} from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useId } from 'react'
import type { BetaRound } from './betaApi'
import type { ReportApi } from './betaReports'
import { badgeTone, formatCountdown, roundPhase } from './countdown'
import ReportPanel from './ReportPanel'
import { surveyFor } from './survey'
import SurveyPanel from './SurveyPanel'
import styles from './RoundView.module.css'
import useServerNow from './useServerNow'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'short' })

// Text typed by the admin: kept as written, with blank lines starting new paragraphs.
function PlainText({ value }: { readonly value: string }) {
	return value
		.split(/\n{2,}/)
		.map(paragraph => paragraph.trim())
		.filter(Boolean)
		.map((paragraph, index) => (
			// The text never reorders, so the position identifies a paragraph.
			<p key={index} className={styles.text}>
				{paragraph}
			</p>
		))
}

function statusLine(round: BetaRound, now: number) {
	switch (roundPhase(round, now)) {
		case 'upcoming':
			return `The beta starts in ${formatCountdown(round.startsAt - now)}.`
		case 'open':
			return `${formatCountdown(round.endsAt - now)} left`
		case 'closed':
			return 'This beta round has ended. Thank you for helping!'
	}
}

// One beta round as a tester sees it: where it stands, a link into the game, and the
// admin's welcome, announcements, and instructions.
export default function RoundView({
	round,
	serverNow,
	localAt,
	preview,
	gameUrl,
	userId,
	reportApi,
	prepareScreenshot,
}: {
	readonly round: BetaRound
	readonly serverNow: number
	readonly localAt: number
	readonly preview: boolean
	// The game itself, which opens in another tab so this page stays at hand.
	readonly gameUrl: string
	readonly userId: string
	// Without it there is nowhere to send feedback, so the panel is left out.
	readonly reportApi?: ReportApi
	readonly prepareScreenshot?: (file: Blob) => Promise<Blob>
}) {
	const titleId = useId()
	const now = useServerNow(serverNow, localAt)
	// A round whose questions this version of the app does not have has no survey to offer.
	const survey = surveyFor(round.surveyVersion)
	return (
		<article className={styles.round} aria-labelledby={titleId}>
			<header className={styles.header}>
				<div className={styles.headerText}>
					<h2 id={titleId} className={styles.name}>
						{round.name}
					</h2>
					<p className={styles.dates}>
						{dateFormat.format(round.startsAt)} -{' '}
						{dateFormat.format(round.endsAt)}
					</p>
				</div>
				<div className={styles.headerBlocks}>
					<p
						className={styles.countdown}
						data-tone={badgeTone(round, now)}
					>
						{statusLine(round, now)}
					</p>
					<a
						className={styles.gameLink}
						href={gameUrl}
						target="_blank"
						rel="noopener noreferrer"
					>
						Play Now
						<FontAwesomeIcon
							icon={faArrowUpRightFromSquare}
							aria-hidden="true"
						/>
					</a>
				</div>
			</header>
			{preview && (
				<p className={styles.preview} role="note">
					You are previewing as the admin. You are not a tester, so
					nothing here is recorded.
				</p>
			)}
			<div className={styles.masonry}>
				<section className={styles.panel} aria-label="Welcome">
					{round.welcome.trim() && (
						<>
							<Heading level={3} className={styles.heading}>
								Welcome!
							</Heading>
							<PlainText value={round.welcome} />
						</>
					)}
					{round.instructions.trim() && (
						<>
							<Heading level={3} className={styles.heading}>
								How to test
							</Heading>
							<PlainText value={round.instructions} />
						</>
					)}
				</section>
				{reportApi && !preview && roundPhase(round, now) === 'open' && (
					<ReportPanel
						roundId={round.id}
						userId={userId}
						api={reportApi}
						prepare={prepareScreenshot}
					/>
				)}
				{reportApi &&
					survey &&
					!preview &&
					roundPhase(round, now) === 'open' && (
						<SurveyPanel
							survey={survey}
							roundId={round.id}
							api={reportApi}
							alreadySent={round.surveySubmitted}
						/>
					)}
				{round.announcements.length > 0 && (
					<section className={styles.panel}>
						<Heading level={3} className={styles.heading}>
							Announcements
						</Heading>
						<ul className={styles.announcements}>
							{round.announcements.map(announcement => (
								<li key={announcement.id}>
									<h4 className={styles.announcementTitle}>
										{announcement.pinned && (
											<FontAwesomeIcon
												icon={faThumbtack}
												aria-label="Pinned"
											/>
										)}
										{announcement.title}
									</h4>
									<p className={styles.dates}>
										{dateFormat.format(
											announcement.publishedAt,
										)}
									</p>
									<PlainText value={announcement.body} />
								</li>
							))}
						</ul>
					</section>
				)}
			</div>
		</article>
	)
}
