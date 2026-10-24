import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProvider } from '@/test/renderWithProvider'
import { palettes, testContent } from '@/test/playerContent'
import type { PlayerContent } from '@/ui/content'
import { coordinateKey, generatePuzzle } from '@/domain/puzzles'
import {
	dragTo,
	pieceButton,
	stubPointerHitTesting,
	tileAt,
} from '@/test/puzzleInteraction'
import { INTRO_PALETTE_IDS } from '@/domain/palettes'
import PuzzleMode from '@/features/puzzle/PuzzleMode'

const INTRO_KEY = 'kaleidoscope:puzzle-intro'

function puzzleSet(id: string, track: 'basic' | 'rotation') {
	return {
		id,
		name: id,
		shape: 'hexagon' as const,
		track,
		kind: 'core' as const,
		puzzles: [
			{
				id: `${id}-1`,
				name: 'One',
				difficulty: 'easy' as const,
				palette: palettes[1],
				puzzle: generatePuzzle(id, palettes[1]),
			},
		],
	}
}

const content: PlayerContent = {
	...testContent,
	puzzleSets: [puzzleSet('Basic', 'basic'), puzzleSet('Turning', 'rotation')],
}

// The same puzzle the tutorial builds, built from the first palette.
const introPuzzle = (rotation: boolean) =>
	generatePuzzle(
		'intro-3',
		testContent.palettes[0],
		{ size: 'sm', rotation },
		'hexagon',
	)

function solveBasicIntro() {
	const puzzle = introPuzzle(false)
	for (const [index, piece] of puzzle.pieces.entries())
		dragTo(
			pieceButton(index),
			tileAt(coordinateKey(puzzle.solution[piece.id])),
		)
}

function seenIntros() {
	return JSON.parse(localStorage.getItem(INTRO_KEY) ?? '{}').seen
}

describe('Puzzle Mode introductions', () => {
	beforeEach(() => localStorage.clear())
	stubPointerHitTesting()

	it('teaches a first-time player before showing the sets, and guides each step', () => {
		renderWithProvider(<PuzzleMode />, content)
		expect(
			screen.getByRole('heading', { name: 'Welcome!' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('heading', { name: 'Puzzle Sets' }),
		).not.toBeInTheDocument()
		expect(screen.getByText(/Match the picture/)).toBeInTheDocument()

		const puzzle = introPuzzle(false)
		dragTo(
			pieceButton(0),
			tileAt(coordinateKey(puzzle.solution[puzzle.pieces[0].id])),
		)
		expect(screen.getByText(/Nice! Keep going/)).toBeInTheDocument()
	})

	it('builds each tutorial from its own palette', () => {
		const mindfulness = { ...palettes[3], id: INTRO_PALETTE_IDS.basic }
		renderWithProvider(<PuzzleMode />, {
			...content,
			palettes: [palettes[0], mindfulness],
		})
		const fills = [
			...screen
				.getByRole('img', { name: 'Target design' })
				.querySelectorAll('polygon'),
		].map(cell => cell.getAttribute('fill'))
		expect(
			fills.some(fill => mindfulness.colors.includes(fill ?? '')),
		).toBe(true)
		expect(
			fills.every(fill => !palettes[0].colors.includes(fill ?? '')),
		).toBe(true)
	})

	it('places the guidance just above the board', () => {
		renderWithProvider(<PuzzleMode />, content)
		const board = screen.getByRole('group', { name: 'Puzzle board' })
		expect(board.parentElement?.previousElementSibling).toContainElement(
			screen.getByText(/Match the picture/),
		)
	})

	it('congratulates, remembers completion only on Continue, then lists the sets', async () => {
		const user = userEvent.setup()
		const view = renderWithProvider(<PuzzleMode />, content)
		solveBasicIntro()
		expect(
			screen.getByRole('heading', { name: 'Congratulations!' }),
		).toBeInTheDocument()
		expect(localStorage.getItem(INTRO_KEY)).toBeNull()
		// Continue takes the place of the guidance, just above the board.
		expect(
			screen.getByRole('group', { name: 'Puzzle board' }).parentElement
				?.previousElementSibling,
		).toContainElement(screen.getByRole('button', { name: 'Continue' }))
		await user.click(screen.getByRole('button', { name: 'Continue' }))
		expect(
			screen.getByRole('heading', { name: 'Puzzle Sets' }),
		).toBeInTheDocument()
		expect(seenIntros()).toEqual(['basic'])
		view.unmount()
		renderWithProvider(<PuzzleMode />, content)
		expect(
			screen.getByRole('heading', { name: 'Puzzle Sets' }),
		).toBeInTheDocument()
	})

	it('repeats an unfinished introduction after a reload', () => {
		const view = renderWithProvider(<PuzzleMode />, content)
		view.unmount()
		renderWithProvider(<PuzzleMode />, content)
		expect(
			screen.getByRole('heading', { name: 'Welcome!' }),
		).toBeInTheDocument()
	})

	it('skips the introduction for a player who has solved basic puzzles', () => {
		localStorage.setItem(
			'kaleidoscope:puzzle-progress',
			JSON.stringify({ version: 1, solved: ['Basic-1'] }),
		)
		renderWithProvider(<PuzzleMode />, content)
		expect(
			screen.getByRole('heading', { name: 'Puzzle Sets' }),
		).toBeInTheDocument()
	})

	it('does not interrupt a player when nothing has been released', () => {
		renderWithProvider(<PuzzleMode />, { ...testContent, puzzleSets: [] })
		expect(
			screen.getByText(/No puzzles are available yet/),
		).toBeInTheDocument()
	})

	it('does not show the rotation lesson when opening a basic set', () => {
		localStorage.setItem(
			INTRO_KEY,
			JSON.stringify({ version: 1, seen: ['basic'] }),
		)
		renderWithProvider(<PuzzleMode />, content)
		fireEvent.click(screen.getByRole('button', { name: /Basic/ }))
		expect(
			screen.queryByRole('heading', { name: 'Welcome!' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: /^Puzzle 1,/ }),
		).toBeInTheDocument()
	})

	describe('rotation', () => {
		beforeEach(() =>
			localStorage.setItem(
				INTRO_KEY,
				JSON.stringify({ version: 1, seen: ['basic'] }),
			),
		)

		it('teaches turning the first time a rotation set opens, then shows that set', async () => {
			const user = userEvent.setup()
			renderWithProvider(<PuzzleMode />, content)
			await user.click(screen.getByRole('button', { name: /Turning/ }))
			expect(
				screen.getByRole('heading', { name: 'Welcome!' }),
			).toBeInTheDocument()
			expect(
				screen.getByText(/Tap a piece in the tray to rotate it/),
			).toBeInTheDocument()

			const puzzle = introPuzzle(true)
			await user.click(pieceButton(0))
			expect(
				screen.getByText(/Keep tapping until the colors line up/),
			).toBeInTheDocument()
			for (const [index, piece] of puzzle.pieces.entries()) {
				const turns = puzzle.solution[piece.id].rotation ?? 0
				// The first piece was already tapped once above.
				for (let turn = index === 0 ? 1 : 0; turn < turns; turn++)
					await user.click(pieceButton(index))
				dragTo(
					pieceButton(index),
					tileAt(coordinateKey(puzzle.solution[piece.id])),
				)
			}
			expect(
				screen.getByText("You've solved your first rotation puzzle."),
			).toBeInTheDocument()
			await user.click(screen.getByRole('button', { name: 'Continue' }))
			expect(seenIntros()).toEqual(['basic', 'rotation'])
			expect(
				screen.getByRole('button', { name: /^Puzzle 1,/ }),
			).toBeInTheDocument()
		})
	})
})
