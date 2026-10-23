import {
	faCalendarPen,
	faCalendarPlus,
	faCalendarXmark,
} from '@fortawesome/pro-solid-svg-icons'
import { AdminIconButton } from '@/features/admin/common'
import {
	packageShapeOf,
	releaseStateOf,
	type ReleaseKind,
} from '@/features/admin/services'
import type { ReleaseTarget } from './ReleaseDialog'
import ReleaseStatusIcon from './ReleaseStatusIcon'

const nouns: Record<ReleaseKind, string> = {
	shape_package: 'package',
	puzzle_group: 'group',
	palette_group: 'palette group',
}

// The schedule, reschedule, and unschedule buttons for one group or palette, by its state,
// with a status mark: green once live (no buttons then), blue while scheduled, and orange
// on a draft with something blocking its release. Core and bonus groups
// in a slot are released with their shape's other three as a package, and only from the Release
// tab, so pass `slot` for puzzle groups elsewhere to hide their buttons.
export default function ReleaseActions({
	kind,
	id,
	name,
	row,
	slot,
	issue,
	disabled,
	onStart,
}: {
	readonly kind: ReleaseKind
	readonly id: string
	readonly name: string
	readonly row: {
		readonly published_at: string | null
		readonly release_at: string | null
	}
	// The group's purpose, shape, and track, to tell whether it belongs to a shape package.
	readonly slot?: {
		readonly purpose: string | null
		readonly shape_id: string | null
		readonly track: string | null
	}
	// What blocks releasing a draft, shown as an orange mark.
	readonly issue?: string
	readonly disabled?: boolean
	readonly onStart: (target: ReleaseTarget) => void
}) {
	const state = releaseStateOf(row)
	if (state === 'live')
		return <ReleaseStatusIcon status="live" label="Live" />
	// Packaged groups are released from the Release tab, so only their state shows here.
	if (kind === 'puzzle_group' && slot && packageShapeOf(slot))
		return state === 'scheduled' ? (
			<ReleaseStatusIcon status="scheduled" label="Scheduled" />
		) : null
	const target = { kind, id, name, currentReleaseAt: row.release_at }
	const label = (verb: string) =>
		kind === 'shape_package'
			? `${verb} ${name}`
			: `${verb} ${nouns[kind]} ${name}`
	return (
		<>
			{state === 'scheduled' && (
				<ReleaseStatusIcon status="scheduled" label="Scheduled" />
			)}
			{state === 'draft' && issue && (
				<ReleaseStatusIcon status="blocked" label={issue} />
			)}
			{state === 'draft' && (
				<AdminIconButton
					icon={faCalendarPlus}
					label={label('Schedule')}
					disabled={disabled}
					onClick={() => onStart({ ...target, action: 'schedule' })}
				/>
			)}
			{state === 'scheduled' && (
				<AdminIconButton
					icon={faCalendarPen}
					label={label('Reschedule')}
					tone="edit"
					disabled={disabled}
					onClick={() => onStart({ ...target, action: 'schedule' })}
				/>
			)}
			{state === 'scheduled' && (
				<AdminIconButton
					icon={faCalendarXmark}
					label={label('Unschedule')}
					tone="delete"
					disabled={disabled}
					onClick={() => onStart({ ...target, action: 'cancel' })}
				/>
			)}
		</>
	)
}
