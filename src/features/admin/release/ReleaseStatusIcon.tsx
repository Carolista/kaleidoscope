import {
	faCalendarCheck,
	faCircleCheck,
	faCircleExclamation,
} from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styles from './ReleaseStatusIcon.module.css'

const icons = {
	live: faCircleCheck,
	scheduled: faCalendarCheck,
	partial: faCircleCheck,
	blocked: faCircleExclamation,
}

export type ReleaseStatus = keyof typeof icons

// A small status mark where release buttons would otherwise be missing or
// need explaining: green when live, blue when scheduled, yellow when only some
// of a group's palettes are out, orange when something blocks a release.
export default function ReleaseStatusIcon({
	status,
	label,
}: {
	readonly status: ReleaseStatus
	readonly label: string
}) {
	return (
		<span
			role="img"
			aria-label={label}
			title={label}
			className={`${styles.icon} ${styles[status]}`}
		>
			<FontAwesomeIcon icon={icons[status]} aria-hidden="true" />
		</span>
	)
}

// Reward palettes go out one by one with what awards them, never as a group,
// so their group is yellow while some are out and green once all are live.
export function RewardGroupMark({
	progress,
}: {
	readonly progress: {
		readonly live: number
		readonly scheduled: number
		readonly total: number
	}
}) {
	if (progress.total > 0 && progress.live === progress.total)
		return <ReleaseStatusIcon status="live" label="All palettes live" />
	if (progress.live + progress.scheduled > 0)
		return <ReleaseStatusIcon status="partial" label="Partly released" />
	return null
}
