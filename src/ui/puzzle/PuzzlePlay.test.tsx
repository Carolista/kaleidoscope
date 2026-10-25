import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { palettes } from '@/test/playerContent'
import {
	coordinateKey,
	generatePuzzle,
	pieceCells,
	PUZZLE_RECIPES,
	type Puzzle,
} from '@/domain/puzzles'
import {
	dragTo,
	hitTest,
	pieceButton,
	stubPointerHitTesting,
	tileAt,
} from '@/test/puzzleInteraction'
import PuzzlePlay from './PuzzlePlay'
import boardStyles from './PuzzleBoard.module.css'
import styles from './PuzzlePlay.module.css'

function renderPlay(puzzle: Puzzle) {
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
		const preview = generatePuzzle(
			'preview-layout',
			palettes[1],
			PUZZLE_RECIPES[0],
		)
		renderPlay(preview)
		const restart = screen.getByRole('button', { name: 'Restart' })
		expect(restart.parentElement).toHaveClass(styles.goalAndPieces)
		expect(
			screen.getByRole('group', { name: 'Puzzle pieces' }).nextSibling,
		).toBe(restart)
		expect(screen.getByRole('status')).toHaveClass('visually-hidden')
	})
	it('reports how many pieces are placed and whether any is turned', async () => {
		const user = userEvent.setup()
		const onProgress = vi.fn()
		const rotated = generatePuzzle(
			'tray-progress',
			palettes[1],
			PUZZLE_RECIPES[1],
		)
		render(
			<PuzzlePlay
				puzzle={rotated}
				solvedMessage="Solved."
				onProgress={onProgress}
			/>,
		)
		expect(onProgress).toHaveBeenLastCalledWith({
			placed: 0,
			rotated: false,
		})
		await user.click(pieceButton(0))
		expect(onProgress).toHaveBeenLastCalledWith({
			placed: 0,
			rotated: true,
		})
		dragTo(
			pieceButton(0),
			tileAt(coordinateKey(rotated.solution[rotated.pieces[0].id])),
		)
		expect(onProgress).toHaveBeenLastCalledWith({
			placed: 1,
			rotated: true,
		})
	})

	describe('rotating a held piece', () => {
		const recipe = PUZZLE_RECIPES.find(
			value => value.id === 'moderate-small',
		)!
		const rotated = generatePuzzle('tray-rotation', palettes[1], recipe)
		const index = rotated.pieces.findIndex(piece => piece.tiles.length > 1)

		function hold(pointerType: 'mouse' | 'touch') {
			renderPlay(rotated)
			const button = pieceButton(index)
			hitTest.mockReturnValue(null)
			fireEvent.pointerDown(button, {
				pointerId: 1,
				pointerType,
				button: 0,
				clientX: 10,
				clientY: 10,
			})
			fireEvent.pointerMove(button, {
				pointerId: 1,
				pointerType,
				clientX: 100,
				clientY: 100,
			})
			const graphic = document.querySelector(
				`.${boardStyles.draggedPiece}`,
			)!
			const points = (svg: Element) =>
				[...svg.querySelectorAll('polygon')].map(tile =>
					tile.getAttribute('points'),
				)
			return { button, graphic, points }
		}

		it('holds a touched piece above the fingertip, but a mouse piece at the pointer', () => {
			const centerOf = (graphic: Element) => {
				const style = (graphic as SVGElement).style
				return {
					x: parseFloat(style.left) + parseFloat(style.width) / 2,
					y: parseFloat(style.top) + parseFloat(style.height) / 2,
				}
			}
			const touch = hold('touch')
			expect(centerOf(touch.graphic).x).toBeCloseTo(100, 6)
			expect(centerOf(touch.graphic).y).toBeLessThan(100)
			cleanup()
			const mouse = hold('mouse')
			expect(centerOf(mouse.graphic)).toEqual({ x: 100, y: 100 })
		})

		it('turns with the R key and keeps the turn when dropped in the air', () => {
			const { button, graphic, points } = hold('mouse')
			const trayBefore = points(button.querySelector('svg')!)
			const before = points(graphic)
			fireEvent.keyDown(window, { key: 'r' })
			expect(points(graphic)).not.toEqual(before)
			fireEvent.pointerUp(button, {
				pointerId: 1,
				pointerType: 'mouse',
				clientX: 100,
				clientY: 100,
			})
			expect(points(button.querySelector('svg')!)).not.toEqual(trayBefore)
		})

		it('ignores R with a modifier, so browser shortcuts still work', () => {
			const { graphic, points } = hold('mouse')
			const before = points(graphic)
			fireEvent.keyDown(window, { key: 'r', metaKey: true })
			expect(points(graphic)).toEqual(before)
		})

		it('turns with a right-click while a mouse holds the piece', () => {
			const { graphic, points } = hold('mouse')
			const before = points(graphic)
			expect(fireEvent.contextMenu(document.body)).toBe(false)
			expect(points(graphic)).not.toEqual(before)
		})

		it('turns when a second finger taps, but not for a second mouse event', () => {
			const { graphic, points } = hold('touch')
			const before = points(graphic)
			fireEvent.pointerDown(document.body, {
				pointerId: 1,
				pointerType: 'touch',
			})
			expect(points(graphic)).toEqual(before)
			fireEvent.pointerDown(document.body, {
				pointerId: 2,
				pointerType: 'touch',
			})
			expect(points(graphic)).not.toEqual(before)
		})

		it('leaves a lifted board piece as it was when the turn is dropped nowhere', async () => {
			renderPlay(rotated)
			const piece = rotated.pieces[index]
			const button = pieceButton(index)
			const user = userEvent.setup()
			for (let i = 0; i < (rotated.solution[piece.id].rotation ?? 0); i++)
				await user.click(button)
			const destination = tileAt(
				coordinateKey(rotated.solution[piece.id]),
			)
			dragTo(button, destination)
			const placedFill = destination.getAttribute('fill')
			hitTest.mockReturnValue(null)
			fireEvent.pointerDown(destination, {
				pointerId: 5,
				pointerType: 'mouse',
				button: 0,
				clientX: 10,
				clientY: 10,
			})
			fireEvent.pointerMove(destination, {
				pointerId: 5,
				pointerType: 'mouse',
				clientX: 300,
				clientY: 300,
			})
			fireEvent.keyDown(window, { key: 'r' })
			fireEvent.pointerUp(destination, {
				pointerId: 5,
				pointerType: 'mouse',
				clientX: 300,
				clientY: 300,
			})
			expect(button).toHaveAccessibleName(/on board/)
			expect(destination).toHaveAttribute('fill', placedFill)
		})
	})

	it('rotates only tray pieces on click or keyboard activation, keeping square slots stable', async () => {
		const user = userEvent.setup()
		const recipe = PUZZLE_RECIPES.find(
			value => value.id === 'moderate-small',
		)!
		const rotated = generatePuzzle('tray-rotation', palettes[1], recipe)
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
			const recipe = PUZZLE_RECIPES.find(
				value => value.id === 'moderate-small',
			)!
			const rotated = generatePuzzle('tray-drag', palettes[1], recipe)
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
			const recipe = PUZZLE_RECIPES.find(
				value => value.id === 'moderate-small',
			)!
			const rotated = generatePuzzle('tray-return', palettes[1], recipe)
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
			expect(destination).toHaveAttribute('fill', 'var(--accent)')
		},
	)

	describe('triangle puzzles', () => {
		const recipe = PUZZLE_RECIPES.find(
			value => value.id === 'moderate-small',
		)!
		const triangle = generatePuzzle(
			'triangle-play',
			palettes[1],
			recipe,
			'triangle',
		)
		const firstCell = (index: number) => {
			const piece = triangle.pieces[index]
			return coordinateKey(
				pieceCells(piece, triangle.solution[piece.id])[0],
			)
		}

		it('renders triangular target and board tiles with a seven-tile wedge', () => {
			renderPlay(triangle)
			for (const name of ['Target design', 'Puzzle board']) {
				const svg = screen.getByRole(
					name === 'Puzzle board' ? 'group' : 'img',
					{
						name,
					},
				)
				const polygons = [...svg.querySelectorAll('polygon')]
				expect(polygons).toHaveLength(25)
				for (const polygon of polygons)
					expect(
						polygon.getAttribute('points')!.split(' '),
					).toHaveLength(3)
			}
			expect(
				document.querySelectorAll('[data-puzzle-cell]'),
			).toHaveLength(7)
		})

		it('solves by rotating with the keyboard and placing each first tile', async () => {
			const user = userEvent.setup()
			renderPlay(triangle)
			for (const [index, piece] of triangle.pieces.entries()) {
				pieceButton(index).focus()
				const turns = triangle.solution[piece.id].rotation ?? 0
				for (let i = 0; i < (turns || 6); i++)
					await user.keyboard('{Enter}')
				tileAt(firstCell(index)).focus()
				await user.keyboard('{Enter}')
				expect(pieceButton(index)).toHaveAccessibleName(/on board/)
			}
			expect(screen.getByRole('status')).toHaveTextContent('Solved.')
			const board = screen.getByRole('group', { name: 'Puzzle board' })
			for (const polygon of board.querySelectorAll('polygon'))
				expect(polygon).not.toHaveAttribute('fill', 'var(--accent)')
		})

		it('drops a rotated piece by the grabbed tile', async () => {
			const user = userEvent.setup()
			renderPlay(triangle)
			const index = triangle.pieces.findIndex(
				piece => piece.tiles.length > 1,
			)
			const piece = triangle.pieces[index]
			const button = pieceButton(index)
			for (
				let i = 0;
				i < (triangle.solution[piece.id].rotation ?? 0);
				i++
			)
				await user.click(button)
			dragTo(button, tileAt(firstCell(index)))
			expect(button).toHaveAccessibleName(/on board/)
			for (const cell of pieceCells(piece, triangle.solution[piece.id]))
				expect(tileAt(coordinateKey(cell))).toHaveAttribute(
					'fill',
					cell.color,
				)
		})
	})

	describe('diamond star puzzles', () => {
		const diamond = generatePuzzle(
			'diamond-play',
			palettes[1],
			PUZZLE_RECIPES.find(value => value.id === 'moderate-small')!,
			'diamondStar',
		)

		it('renders rhombus tiles and rotates tray pieces 180 degrees through two orientations', async () => {
			const user = userEvent.setup()
			renderPlay(diamond)
			const board = screen.getByRole('group', { name: 'Puzzle board' })
			expect(board.querySelectorAll('polygon')).toHaveLength(6 * 9)
			for (const polygon of board.querySelectorAll('polygon'))
				expect(polygon.getAttribute('points')!.split(' ')).toHaveLength(
					4,
				)
			expect(
				document.querySelectorAll('[data-puzzle-cell]'),
			).toHaveLength(6)
			const index = diamond.pieces.findIndex(
				piece => piece.tiles.length > 1,
			)
			const button = pieceButton(index)
			expect(button).toHaveAccessibleDescription(/rotate 180 degrees/)
			const points = () =>
				[...button.querySelectorAll('polygon')].map(tile =>
					tile.getAttribute('points'),
				)
			const original = points()
			await user.click(button)
			expect(points()).not.toEqual(original)
			expect(screen.getByRole('status')).toHaveTextContent(
				'Piece rotated 180 degrees.',
			)
			await user.click(button)
			expect(points()).toEqual(original)
		})

		it('solves with keyboard rotation and placement', async () => {
			const user = userEvent.setup()
			renderPlay(diamond)
			expect(
				Object.values(diamond.solution).some(
					value => value.rotation === 3,
				),
			).toBe(true)
			for (const [index, piece] of diamond.pieces.entries()) {
				pieceButton(index).focus()
				const turns = (diamond.solution[piece.id].rotation ?? 0) / 3
				for (let i = 0; i < (turns || 2); i++)
					await user.keyboard('{Enter}')
				tileAt(
					coordinateKey(
						pieceCells(piece, diamond.solution[piece.id])[0],
					),
				).focus()
				await user.keyboard('{Enter}')
				expect(pieceButton(index)).toHaveAccessibleName(/on board/)
			}
			expect(screen.getByRole('status')).toHaveTextContent('Solved.')
		})
	})
})
