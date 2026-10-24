import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProvider } from '@/test/renderWithProvider'
import { palettes, testContent } from '@/test/playerContent'
import type { PlayerContent } from '@/ui/content'
import { coordinateKey, generatePuzzle } from '@/domain/puzzles'
import {
	dragTo,
	markPuzzleIntrosSeen,
	pieceButton,
	stubPointerHitTesting,
	tileAt,
} from '@/test/puzzleInteraction'
import PuzzleMode from './PuzzleMode'

type FakeAnimation = { cancel: () => void; onfinish: (() => void) | null }

const first = generatePuzzle('swipe-one', palettes[1])
const content: PlayerContent = {
	...testContent,
	puzzleSets: [
		{
			id: 'set-one',
			name: 'Starter',
			shape: 'hexagon',
			track: 'basic',
			kind: 'core',
			puzzles: [
				{
					id: 'p1',
					name: 'One',
					difficulty: 'easy',
					palette: palettes[1],
					puzzle: first,
				},
				{
					id: 'p2',
					name: 'Two',
					difficulty: 'moderate',
					palette: palettes[1],
					puzzle: generatePuzzle('swipe-two', palettes[1]),
				},
			],
		},
	],
}

function open() {
	renderWithProvider(<PuzzleMode />, content)
	fireEvent.click(screen.getByRole('button', { name: /Starter/ }))
	fireEvent.click(screen.getByRole('button', { name: /^Puzzle 1,/ }))
}

describe('puzzle swipe', () => {
	const animations: FakeAnimation[] = []
	const originalAnimate = Element.prototype.animate

	beforeEach(() => {
		localStorage.clear()
		markPuzzleIntrosSeen()
		animations.length = 0
		Element.prototype.animate = vi.fn(() => {
			const animation: FakeAnimation = { cancel: vi.fn(), onfinish: null }
			animations.push(animation)
			return animation as unknown as Animation
		})
	})

	afterEach(() => {
		Element.prototype.animate = originalAnimate
		vi.unstubAllGlobals()
	})

	stubPointerHitTesting()

	it('flies a puzzle in from the right when first opened', () => {
		open()
		expect(Element.prototype.animate).toHaveBeenCalledTimes(1)
		expect(animations).toHaveLength(1)
	})

	it('flies the solved puzzle out to the left as the next one flies in, then drops the copy', () => {
		open()
		for (const [index, piece] of first.pieces.entries()) {
			dragTo(
				pieceButton(index),
				tileAt(coordinateKey(first.solution[piece.id])),
			)
		}
		animations.length = 0
		fireEvent.click(screen.getByRole('button', { name: 'Next puzzle' }))

		expect(animations).toHaveLength(2)
		const stage = screen.getByRole('group', { name: 'Puzzle board' })
			.parentElement!.parentElement!.parentElement!.parentElement!
		const clones = [
			...stage.querySelectorAll('[aria-hidden="true"]'),
		].filter(node => (node as HTMLElement).inert)
		expect(clones).toHaveLength(1)
		expect(
			clones[0].querySelector('[aria-label="Puzzle board"]'),
		).not.toBeNull()

		animations[0].onfinish?.()
		expect(
			[...stage.querySelectorAll('[aria-hidden="true"]')].filter(
				node => (node as HTMLElement).inert,
			),
		).toHaveLength(0)
	})

	it('swaps instantly when the user prefers reduced motion', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: true }))
		open()
		expect(Element.prototype.animate).not.toHaveBeenCalled()
	})
})
