import { isPuzzleShapeId, PUZZLE_SHAPE_LABELS } from '@/domain/puzzles'
import {
	releaseStateOf,
	type ChangeCounts,
	type ReleaseAction,
	type ReleaseItem,
	type ReleaseItemKind,
	type ReleasePlan,
} from '@/features/admin/services'

export const itemKindLabels: Record<
	ReleaseItemKind,
	{ readonly one: string; readonly many: string }
> = {
	palette: { one: 'palette', many: 'palettes' },
	puzzle: { one: 'puzzle', many: 'puzzles' },
	puzzle_group: { one: 'puzzle group', many: 'puzzle groups' },
	palette_group: { one: 'palette group', many: 'palette groups' },
}

const order: readonly ReleaseItemKind[] = [
	'palette',
	'puzzle',
	'palette_group',
	'puzzle_group',
]

// A release time for people: the browser's own time zone, date and time.
export function formatReleaseTime(instant: string): string {
	return new Date(instant).toLocaleString(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	})
}

// "3 palettes, 48 puzzles, and 2 puzzle groups", skipping kinds with none.
export function describeCounts(counts: ChangeCounts): string {
	const parts = order
		.filter(kind => counts[kind] > 0)
		.map(
			kind =>
				`${counts[kind]} ${counts[kind] === 1 ? itemKindLabels[kind].one : itemKindLabels[kind].many}`,
		)
	if (parts.length <= 1) return parts.join('')
	if (parts.length === 2) return parts.join(' and ')
	return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

export function summaryText(
	action: ReleaseAction,
	counts: ChangeCounts,
	releaseNow: boolean,
): string {
	const what = describeCounts(counts)
	if (!what) return 'Nothing changes.'
	if (action === 'cancel') return `This returns ${what} to draft.`
	return releaseNow
		? `This releases ${what} immediately. Live content can never be changed afterward.`
		: `This schedules ${what}.`
}

// Shown on cards: nothing for a draft, the date for a scheduled item, "Live" once released.
export function releaseStateLabel(row: {
	readonly published_at: string | null
	readonly release_at: string | null
}): string {
	const state = releaseStateOf(row)
	if (state === 'draft') return ''
	return state === 'live' || !row.release_at
		? 'Live'
		: `Scheduled for ${formatReleaseTime(row.release_at)}`
}

// The confirmation shown after a plan has been applied.
export function releaseStatusMessage(
	plan: Pick<ReleasePlan, 'action' | 'name' | 'releaseAt'>,
): string {
	if (plan.action === 'cancel') return `Unscheduled "${plan.name}".`
	if (plan.releaseAt && new Date(plan.releaseAt) > new Date())
		return `Scheduled "${plan.name}" for ${formatReleaseTime(plan.releaseAt)}.`
	return `Released "${plan.name}".`
}

// A short note on what happens to one item beyond the plain release or cancel.
export function itemNote(item: ReleaseItem): string {
	const previous = item.previousReleaseAt
		? formatReleaseTime(item.previousReleaseAt)
		: ''
	switch (item.change) {
		case 'earlier':
			return `moves earlier, from ${previous}`
		case 'reschedule':
			return `moves from ${previous}`
		case 'keep':
			return `already scheduled for ${previous}`
		case 'live':
			return 'already live'
		default:
			return ''
	}
}

export function shapeLabel(shapeId: string | null): string {
	if (shapeId === null) return 'All shapes'
	return isPuzzleShapeId(shapeId) ? PUZZLE_SHAPE_LABELS[shapeId] : shapeId
}

// Draft, the scheduled date, or Live, for a row with release columns.
export function releaseStateText(row: {
	readonly published_at: string | null
	readonly release_at: string | null
}): string {
	return releaseStateOf(row) === 'draft' ? 'Draft' : releaseStateLabel(row)
}
