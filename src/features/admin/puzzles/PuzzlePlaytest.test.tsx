import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { palettes } from '@/test/playerContent'
import { generatePuzzle, PUZZLE_RECIPES } from '@/domain/puzzles'
import PuzzlePlaytest from './PuzzlePlaytest'

describe('PuzzlePlaytest', () => {
	afterEach(() => {
		localStorage.removeItem('kaleidoscope:puzzle:targetGridLines')
		cleanup()
	})

	it('keeps the target grid toggle with Restart and the other actions', () => {
		render(
			<PuzzlePlaytest
				puzzle={generatePuzzle(
					'playtest-grid',
					palettes[0],
					PUZZLE_RECIPES[0],
				)}
				actions={<button type="button">Extra</button>}
			/>,
		)
		const toggle = screen.getByRole('button', {
			name: 'Grid lines on the target',
		})
		const actions = screen.getByRole('button', {
			name: 'Restart',
		}).parentElement
		expect(toggle.parentElement).toBe(actions)
		expect(
			screen.getByRole('button', { name: 'Extra' }).parentElement,
		).toBe(actions)
		expect(toggle).toHaveAttribute('aria-pressed', 'true')
		fireEvent.click(toggle)
		expect(toggle).toHaveAttribute('aria-pressed', 'false')
	})
})
