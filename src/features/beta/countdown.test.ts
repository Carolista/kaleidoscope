import { describe, expect, it } from 'vitest'
import type { BetaRound } from './betaApi'
import { badgeTone, formatCountdown, roundPhase } from './countdown'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatCountdown', () => {
	it('counts whole days while 72 hours or more remain', () => {
		expect(formatCountdown(30 * DAY + 5 * HOUR)).toBe('30 days')
		expect(formatCountdown(3 * DAY)).toBe('3 days')
	})

	it('adds hours and minutes in the last 72 hours', () => {
		expect(formatCountdown(3 * DAY - MINUTE)).toBe(
			'2 days, 23 hours, 59 minutes',
		)
		expect(formatCountdown(2 * DAY + 5 * MINUTE)).toBe(
			'2 days, 0 hours, 5 minutes',
		)
		expect(formatCountdown(DAY + 2 * HOUR)).toBe(
			'1 day, 2 hours, 0 minutes',
		)
	})

	it('drops leading units that are zero', () => {
		expect(formatCountdown(23 * HOUR + 12 * MINUTE)).toBe(
			'23 hours, 12 minutes',
		)
		expect(formatCountdown(HOUR)).toBe('1 hour, 0 minutes')
		expect(formatCountdown(12 * MINUTE)).toBe('12 minutes')
	})

	it('rounds minutes up and never goes below zero', () => {
		expect(formatCountdown(1)).toBe('1 minute')
		expect(formatCountdown(59_999)).toBe('1 minute')
		expect(formatCountdown(0)).toBe('0 minutes')
		expect(formatCountdown(-5 * MINUTE)).toBe('0 minutes')
	})
})

describe('roundPhase', () => {
	const round = { startsAt: 1000, endsAt: 2000 } as BetaRound

	it('is upcoming, open, then closed, with the end excluded', () => {
		expect(roundPhase(round, 999)).toBe('upcoming')
		expect(roundPhase(round, 1000)).toBe('open')
		expect(roundPhase(round, 1999)).toBe('open')
		expect(roundPhase(round, 2000)).toBe('closed')
	})
})

describe('badgeTone', () => {
	const round = { startsAt: 0, endsAt: 100 * DAY } as BetaRound
	const left = (ms: number) => badgeTone(round, round.endsAt - ms)

	it('warms up as the deadline nears', () => {
		expect(left(30 * DAY)).toBe('green')
		expect(left(7 * DAY)).toBe('green')
		expect(left(7 * DAY - 1)).toBe('yellow')
		expect(left(3 * DAY)).toBe('yellow')
		expect(left(3 * DAY - 1)).toBe('orange')
		expect(left(2 * DAY)).toBe('orange')
		expect(left(2 * DAY - 1)).toBe('red')
		expect(left(DAY)).toBe('red')
		expect(left(DAY - 1)).toBe('magenta')
		expect(left(1)).toBe('magenta')
	})

	it('is blue before the start and neutral after the end', () => {
		expect(
			badgeTone({ startsAt: 1000, endsAt: 2000 } as BetaRound, 500),
		).toBe('blue')
		expect(badgeTone(round, round.endsAt)).toBe('neutral')
	})
})
