import { beforeEach, describe, expect, it } from 'vitest'
import { palettes } from '@/test/playerContent'
import { generatePuzzle } from '@/domain/puzzles'
import {
	hasProgress,
	loadResume,
	resumeKey,
	restoreAttempt,
	saveResume,
	type PuzzleAttempt,
} from './puzzleResume'

const puzzle = generatePuzzle('resume-seed', palettes[1])
const [first, second] = puzzle.pieces
const attempt = (
	placements: PuzzleAttempt['placements'],
	rotations: PuzzleAttempt['rotations'] = {},
): PuzzleAttempt => ({ setId: 'set', placements, rotations })

beforeEach(() => localStorage.clear())

describe('puzzle resume storage', () => {
	it('round-trips attempts per player', () => {
		const state = {
			current: 'p1',
			attempts: {
				p1: attempt({ [first.id]: puzzle.solution[first.id] }),
			},
		}
		saveResume('user-1', state)
		expect(loadResume('user-1')).toEqual(state)
		expect(loadResume(null).attempts).toEqual({})
		expect(resumeKey(null)).toBe('kaleidoscope:puzzle-resume:guest')
	})

	it('ignores unusable storage', () => {
		for (const raw of [
			'not json',
			'[]',
			JSON.stringify({ version: 99, attempts: {} }),
		]) {
			localStorage.setItem(resumeKey(null), raw)
			expect(loadResume(null)).toEqual({ current: null, attempts: {} })
		}
	})

	it('drops malformed entries and a current puzzle with no attempt', () => {
		localStorage.setItem(
			resumeKey(null),
			JSON.stringify({
				version: 1,
				current: 'gone',
				attempts: {
					ok: { setId: 'set', placements: { a: { q: 1, r: 2 } } },
					noSet: { placements: {} },
					bad: 'x',
				},
			}),
		)
		const state = loadResume(null)
		expect(Object.keys(state.attempts)).toEqual(['ok'])
		expect(state.current).toBeNull()
	})
})

describe('restoreAttempt', () => {
	it('keeps placements that still fit', () => {
		const restored = restoreAttempt(
			puzzle,
			attempt({ [first.id]: puzzle.solution[first.id] }),
		)
		expect(restored?.placements).toEqual({
			[first.id]: puzzle.solution[first.id],
		})
	})

	it('drops placements that are off the board, overlap, or name unknown pieces', () => {
		const solved = puzzle.solution[first.id]
		const restored = restoreAttempt(
			puzzle,
			attempt({
				[first.id]: solved,
				[second.id]: solved,
				ghost: solved,
				[puzzle.pieces[2].id]: { q: 500, r: 500 },
			}),
		)
		expect(Object.keys(restored?.placements ?? {})).toEqual([first.id])
	})

	it('returns null when nothing usable is left', () => {
		expect(
			restoreAttempt(puzzle, attempt({ ghost: { q: 0, r: 0 } })),
		).toBeNull()
		expect(restoreAttempt(puzzle, attempt({}))).toBeNull()
	})

	it('only keeps turns for pieces that exist, within one full turn, on puzzles that rotate', () => {
		const rotating = { ...puzzle, rotationAllowed: true }
		const restored = restoreAttempt(
			rotating,
			attempt({}, { [first.id]: 2, ghost: 1, [second.id]: 9 }),
		)
		expect(restored?.rotations).toEqual({ [first.id]: 2 })
		expect(
			restoreAttempt(
				{ ...puzzle, rotationAllowed: false },
				attempt({}, { [first.id]: 2 }),
			),
		).toBeNull()
	})
})

describe('hasProgress', () => {
	it('is false for an untouched board, true once a piece is placed or turned', () => {
		expect(hasProgress(attempt({}))).toBe(false)
		expect(hasProgress(attempt({}, { a: 0 }))).toBe(false)
		expect(hasProgress(attempt({}, { a: 1 }))).toBe(true)
		expect(hasProgress(attempt({ a: { q: 0, r: 0 } }))).toBe(true)
	})
})
