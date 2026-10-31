import type { BetaRound } from './betaApi'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
// Days are enough until the last three days, then the hours and minutes matter.
const SHOW_MINUTES_UNDER = 3 * DAY

export type RoundPhase = 'upcoming' | 'open' | 'closed'

export function roundPhase(round: BetaRound, now: number): RoundPhase {
	if (now < round.startsAt) return 'upcoming'
	return now < round.endsAt ? 'open' : 'closed'
}

function unit(count: number, name: string) {
	return `${count} ${name}${count === 1 ? '' : 's'}`
}

// "12 days" while 72 hours or more remain; after that "2 days, 5 hours, 12 minutes", dropping
// leading units that are zero. Minutes round up, so the last minute reads "1 minute".
export function formatCountdown(remainingMs: number): string {
	const ms = Math.max(0, remainingMs)
	if (ms >= SHOW_MINUTES_UNDER) return unit(Math.floor(ms / DAY), 'day')
	const total = Math.ceil(ms / MINUTE)
	const parts = [
		Math.floor(total / (24 * 60)),
		Math.floor((total % (24 * 60)) / 60),
		total % 60,
	]
	const names = ['day', 'hour', 'minute']
	const first = parts.findIndex(part => part > 0)
	if (first === -1) return unit(0, 'minute')
	return parts
		.slice(first)
		.map((part, index) => unit(part, names[first + index]))
		.join(', ')
}

export type BadgeTone =
	'green' | 'yellow' | 'orange' | 'red' | 'magenta' | 'blue' | 'neutral'

// The badge's color follows the deadline: calm while there is time, then warmer, up to
// magenta in the last 24 hours. A round yet to start is blue and one that has ended is neutral.
export function badgeTone(round: BetaRound, now: number): BadgeTone {
	const phase = roundPhase(round, now)
	if (phase === 'upcoming') return 'blue'
	if (phase === 'closed') return 'neutral'
	const remaining = round.endsAt - now
	if (remaining < DAY) return 'magenta'
	if (remaining < 2 * DAY) return 'red'
	if (remaining < 3 * DAY) return 'orange'
	if (remaining < 7 * DAY) return 'yellow'
	return 'green'
}
