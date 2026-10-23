import { describe, expect, it } from 'vitest'
import {
	describeCounts,
	formatReleaseTime,
	itemNote,
	releaseStatusMessage,
	summaryText,
} from './releaseText'

const counts = (
	palette = 0,
	puzzle = 0,
	puzzleGroup = 0,
	paletteGroup = 0,
) => ({
	palette,
	puzzle,
	puzzle_group: puzzleGroup,
	palette_group: paletteGroup,
})

describe('describeCounts', () => {
	it('joins the kinds that have items', () => {
		expect(describeCounts(counts(3, 48, 2))).toBe(
			'3 palettes, 48 puzzles, and 2 puzzle groups',
		)
		expect(describeCounts(counts(0, 24, 1))).toBe(
			'24 puzzles and 1 puzzle group',
		)
		expect(describeCounts(counts(1))).toBe('1 palette')
		expect(describeCounts(counts(0, 0, 0, 1))).toBe('1 palette group')
		expect(describeCounts(counts())).toBe('')
	})
})

describe('summaryText', () => {
	it('words each action', () => {
		expect(summaryText('schedule', counts(1), false)).toBe(
			'This schedules 1 palette.',
		)
		expect(summaryText('schedule', counts(1), true)).toBe(
			'This releases 1 palette immediately. Live content can never be changed afterward.',
		)
		expect(summaryText('cancel', counts(0, 2), false)).toBe(
			'This returns 2 puzzles to draft.',
		)
		expect(summaryText('cancel', counts(), false)).toBe('Nothing changes.')
	})
})

describe('itemNote', () => {
	const base = {
		kind: 'palette',
		id: 'p',
		name: 'P',
		state: 'scheduled',
		releaseAt: null,
	} as const
	const previous = '2026-12-01T12:00:00.000Z'

	it('explains what happens to an item', () => {
		const when = formatReleaseTime(previous)
		expect(
			itemNote({
				...base,
				change: 'earlier',
				previousReleaseAt: previous,
			}),
		).toBe(`moves earlier, from ${when}`)
		expect(
			itemNote({
				...base,
				change: 'reschedule',
				previousReleaseAt: previous,
			}),
		).toBe(`moves from ${when}`)
		expect(
			itemNote({ ...base, change: 'keep', previousReleaseAt: previous }),
		).toBe(`already scheduled for ${when}`)
		expect(
			itemNote({ ...base, change: 'live', previousReleaseAt: previous }),
		).toBe('already live')
		expect(
			itemNote({ ...base, change: 'release', previousReleaseAt: null }),
		).toBe('')
		expect(
			itemNote({
				...base,
				change: 'cancel',
				previousReleaseAt: previous,
			}),
		).toBe('')
	})
})

describe('releaseStatusMessage', () => {
	it('reports what was done', () => {
		expect(
			releaseStatusMessage({
				action: 'cancel',
				name: 'Core',
				releaseAt: null,
			}),
		).toBe('Unscheduled "Core".')
		expect(
			releaseStatusMessage({
				action: 'schedule',
				name: 'Core',
				releaseAt: '2999-01-01T00:00:00.000Z',
			}),
		).toBe(
			`Scheduled "Core" for ${formatReleaseTime('2999-01-01T00:00:00.000Z')}.`,
		)
		expect(
			releaseStatusMessage({
				action: 'schedule',
				name: 'Core',
				releaseAt: '2000-01-01T00:00:00.000Z',
			}),
		).toBe('Released "Core".')
	})
})
