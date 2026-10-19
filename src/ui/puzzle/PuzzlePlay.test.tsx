import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { colorSchemes } from '@/domain/palettes'
import {
	coordinateKey,
	generateHexPuzzle,
	HEX_PUZZLE_RECIPES,
	type HexPuzzle,
} from '@/domain/puzzles'
import {
	dragTo,
	hitTest,
	pieceButton,
	stubPointerHitTesting,
	tileAt,
} from '@/test/puzzleInteraction'
import PuzzlePlay from './PuzzlePlay'
import styles from './PuzzlePlay.module.css'

function renderPlay(puzzle: HexPuzzle) {
	return render(
		<PuzzlePlay
			puzzle={puzzle}
			solvedMessage="Solved."
			trayAction={<button type="button">Restart</button>}
		/>,
	)
}

describe('PuzzlePlay', () => {
	stubPointerHitTesting()

	it('places the tray action beside the pieces and keeps feedback for screen readers only', () => {
		const preview = generateHexPuzzle(
			'preview-layout',
			colorSchemes[1],
			HEX_PUZZLE_RECIPES[0],
		)
		renderPlay(preview)
		const restart = screen.getByRole('button', { name: 'Restart' })
		expect(restart.parentElement).toHaveClass(styles.goalAndPieces)
		expect(
			screen.getByRole('group', { name: 'Puzzle pieces' }).nextSibling,
		).toBe(restart)
		expect(screen.getByRole('status')).toHaveClass('visually-hidden')
	})
	it('rotates only tray pieces on click or keyboard activation, keeping square slots stable', async () => {
		const user = userEvent.setup()
		const recipe = HEX_PUZZLE_RECIPES.find(
			value => value.id === 'moderate-small',
		)!
		const rotated = generateHexPuzzle(
			'tray-rotation',
			colorSchemes[1],
			recipe,
		)
		renderPlay(rotated)
		const index = rotated.pieces.findIndex(piece => piece.tiles.length > 1)
		const button = pieceButton(index)
		const svg = button.querySelector('svg')!
		const points = () =>
			[...svg.querySelectorAll('polygon')].map(tile =>
				tile.getAttribute('points'),
			)
		const original = points()
		const size = svg.getAttribute('style')
		const [, , width, height] = svg
			.getAttribute('viewBox')!
			.split(' ')
			.map(Number)
		expect(width).toBe(height)
		await user.click(button)
		expect(points()).not.toEqual(original)
		expect(svg).toHaveAttribute('style', size)
		const afterClick = points()
		await user.click(
			tileAt(coordinateKey(rotated.solution[rotated.pieces[index].id])),
		)
		expect(button).toHaveAccessibleName(/in tray/)
		expect(points()).toEqual(afterClick)
		button.focus()
		await user.keyboard('{Enter}')
		expect(points()).not.toEqual(afterClick)
		await user.keyboard(' ')
		for (let i = 0; i < 3; i++) {
			await user.click(button)
			expect(svg).toHaveAttribute('style', size)
		}
		expect(points()).toEqual(original)
		expect(
			screen.queryByRole('button', { name: 'Rotate selected piece' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', {
				name: 'Return selected piece to tray',
			}),
		).not.toBeInTheDocument()
	})

	it.each(['mouse', 'touch'])(
		'drags a tray piece without rotating it with %s and suppresses the following click',
		pointerType => {
			const recipe = HEX_PUZZLE_RECIPES.find(
				value => value.id === 'moderate-small',
			)!
			const rotated = generateHexPuzzle(
				'tray-drag',
				colorSchemes[1],
				recipe,
			)
			renderPlay(rotated)
			const index = rotated.pieces.findIndex(
				piece => piece.tiles.length > 1,
			)
			const button = pieceButton(index)
			const original = button.querySelector('svg')!.innerHTML
			dragTo(button, null, pointerType)
			fireEvent.click(button)
			expect(button.querySelector('svg')!.innerHTML).toEqual(original)
			expect(button).toHaveAccessibleName(/in tray/)
		},
	)

	it.each(['mouse', 'touch'])(
		'returns a board piece by double-%s activation preserving orientation',
		async pointerType => {
			const user = userEvent.setup()
			const recipe = HEX_PUZZLE_RECIPES.find(
				value => value.id === 'moderate-small',
			)!
			const rotated = generateHexPuzzle(
				'tray-return',
				colorSchemes[1],
				recipe,
			)
			renderPlay(rotated)
			const index = rotated.pieces.findIndex(
				piece => piece.tiles.length > 1,
			)
			const piece = rotated.pieces[index]
			const button = pieceButton(index)
			for (let i = 0; i < (rotated.solution[piece.id].rotation ?? 0); i++)
				await user.click(button)
			const oriented = button.querySelector('svg')!.innerHTML
			const destination = tileAt(
				coordinateKey(rotated.solution[piece.id]),
			)
			dragTo(button, destination, pointerType)
			expect(button).toHaveAccessibleName(/on board/)
			if (pointerType === 'mouse') await user.dblClick(destination)
			else {
				for (let tap = 0; tap < 2; tap++) {
					hitTest.mockReturnValue(destination)
					fireEvent.pointerDown(destination, {
						pointerId: 2,
						pointerType: 'touch',
						button: 0,
						clientX: 20,
						clientY: 20,
					})
					fireEvent.pointerUp(destination, {
						pointerId: 2,
						pointerType: 'touch',
						clientX: 20,
						clientY: 20,
					})
					fireEvent.click(destination)
					if (tap === 0)
						expect(button).toHaveAccessibleName(/on board/)
				}
			}
			expect(button).toHaveAccessibleName(/in tray/)
			expect(button.querySelector('svg')!.innerHTML).toEqual(oriented)
			expect(destination).toHaveAttribute('fill', 'var(--base)')
		},
	)
})
