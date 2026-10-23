import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProvider } from '@/test/renderWithProvider'
import { palettes, testContent } from '@/test/playerContent'
import type { PlayerContent } from '@/ui/content'
import { generateHexagonCells } from '@/domain/shapes/hexagon'
import { coordinateKey, generatePuzzle, pieceCells } from '@/domain/puzzles'
import PuzzleMode from './PuzzleMode'
import styles from '@/ui/puzzle/PuzzleBoard.module.css'
import {
	dragTo,
	hitTest,
	pieceButton,
	stubPointerHitTesting,
	tileAt,
} from '@/test/puzzleInteraction'

const seed = 'ui-puzzle'
const puzzle = generatePuzzle(seed, palettes[1])
const content: PlayerContent = {
	...testContent,
	puzzleSets: [
		{
			id: 'set-one',
			name: 'Starter',
			shape: 'hexagon',
			track: 'basic',
			puzzles: [
				{ id: 'p1', name: 'One', difficulty: 'easy', puzzle },
				{
					id: 'p2',
					name: 'Two',
					difficulty: 'moderate',
					puzzle: generatePuzzle('ui-puzzle-two', palettes[1]),
				},
			],
		},
	],
}

function renderBrowser(ui = <PuzzleMode />) {
	return renderWithProvider(ui, content)
}

// Opens the first puzzle of the only set, as a player would.
function renderPlaying() {
	const view = renderBrowser()
	fireEvent.click(screen.getByRole('button', { name: /Starter/ }))
	fireEvent.click(screen.getByRole('button', { name: /^Puzzle 1,/ }))
	return view
}
function solvePuzzle() {
	for (const [index, piece] of puzzle.pieces.entries()) {
		dragTo(
			pieceButton(index),
			tileAt(coordinateKey(puzzle.solution[piece.id])),
		)
	}
}

function targetColors() {
	return [
		...screen
			.getByRole('img', { name: 'Target design' })
			.querySelectorAll('polygon'),
	].map(cell => cell.getAttribute('fill'))
}

describe('PuzzleMode', () => {
	it.each(['Delete', 'Backspace'])(
		'returns a focused board piece with %s',
		key => {
			renderPlaying()
			const destination = tileAt(
				coordinateKey(puzzle.solution[puzzle.pieces[0].id]),
			)
			dragTo(pieceButton(0), destination)
			fireEvent.keyDown(destination, { key })
			expect(pieceButton(0)).toHaveAccessibleName(/in tray/)
		},
	)

	it('shows Next puzzle only after winning and hides it when the next puzzle starts', async () => {
		const user = userEvent.setup()
		renderPlaying()
		expect(
			screen.queryByRole('button', { name: 'Next puzzle' }),
		).not.toBeInTheDocument()
		solvePuzzle()
		await user.click(
			screen.getByRole('button', { name: 'Close congratulations' }),
		)
		await user.click(screen.getByRole('button', { name: 'Next puzzle' }))
		expect(
			screen.queryByRole('button', { name: 'Next puzzle' }),
		).not.toBeInTheDocument()
		expect(
			screen.getAllByRole('button', { name: /of 6, empty$/ }),
		).toHaveLength(6)
	})

	beforeEach(() => localStorage.clear())
	stubPointerHitTesting()

	it('lists the available sets with their progress and opens one as a numbered grid', async () => {
		const user = userEvent.setup()
		localStorage.setItem(
			'kaleidoscope:puzzle-progress',
			JSON.stringify({ version: 1, solved: ['p2', 'gone'] }),
		)
		renderBrowser()
		expect(
			screen.getByRole('heading', { name: 'Puzzle sets' }),
		).toBeInTheDocument()
		const set = screen.getByRole('button', { name: /Starter/ })
		expect(set).toHaveTextContent('Hexagon · Basic')
		expect(set).toHaveTextContent('1 of 2 solved')
		await user.click(set)
		expect(screen.getByRole('heading', { name: 'Starter' })).toBeVisible()
		expect(
			screen.getByRole('button', { name: 'Puzzle 1, Easy' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Puzzle 2, Moderate, solved' }),
		).toBeInTheDocument()
		await user.click(
			screen.getByRole('button', { name: 'All puzzle sets' }),
		)
		expect(
			screen.getByRole('heading', { name: 'Puzzle sets' }),
		).toBeInTheDocument()
	})

	it('says so when nothing has been released', () => {
		renderWithProvider(<PuzzleMode />, { ...testContent, puzzleSets: [] })
		expect(
			screen.getByText(/No puzzles are available yet/),
		).toBeInTheDocument()
	})

	it('remembers a solved puzzle on this device and marks it in the grid', async () => {
		const user = userEvent.setup()
		const view = renderPlaying()
		solvePuzzle()
		expect(
			JSON.parse(
				localStorage.getItem('kaleidoscope:puzzle-progress') ?? '{}',
			),
		).toEqual({ version: 1, solved: ['p1'] })
		await user.click(
			screen.getByRole('button', { name: 'Close congratulations' }),
		)
		await user.click(
			screen.getByRole('button', { name: 'Back to puzzle set' }),
		)
		expect(
			screen.getByRole('button', { name: 'Puzzle 1, Easy, solved' }),
		).toBeInTheDocument()
		view.unmount()
		renderBrowser()
		expect(
			screen.getByRole('button', { name: /Starter/ }),
		).toHaveTextContent('1 of 2 solved')
	})

	it('finishes the set when no unsolved puzzle is left', async () => {
		const user = userEvent.setup()
		localStorage.setItem(
			'kaleidoscope:puzzle-progress',
			JSON.stringify({ version: 1, solved: ['p2'] }),
		)
		renderPlaying()
		solvePuzzle()
		const dialog = screen.getByRole('dialog', { name: 'Congrats!' })
		expect(dialog).toHaveTextContent('You solved every puzzle in Starter!')
		expect(
			screen.queryByRole('button', { name: 'Next puzzle' }),
		).not.toBeInTheDocument()
		await user.click(
			screen.getByRole('button', { name: 'Choose another puzzle' }),
		)
		expect(screen.getByRole('heading', { name: 'Starter' })).toBeVisible()
	})

	it('moves to the next puzzle in the set without repeating a solved one', async () => {
		const user = userEvent.setup()
		renderPlaying()
		solvePuzzle()
		await user.click(screen.getByRole('button', { name: 'Next Puzzle' }))
		expect(
			screen.getAllByRole('button', { name: /of 6, empty$/ }),
		).toHaveLength(6)
		expect(targetColors()).toEqual(
			generateHexagonCells(
				content.puzzleSets[0].puzzles[1].puzzle.gridSize,
			).map(
				cell =>
					content.puzzleSets[0].puzzles[1].puzzle.target[
						cell.groupId
					],
			),
		)
	})

	it('shows the target, six blank wedge tiles, and three fixed-orientation pieces', () => {
		renderPlaying()
		expect(
			screen.getByRole('img', { name: 'Target design' }),
		).toBeInTheDocument()
		expect(
			screen.getAllByRole('button', {
				name: /^Puzzle tile \d of 6, empty$/,
			}),
		).toHaveLength(6)
		expect(
			screen.getAllByRole('button', { name: /^Select piece/ }),
		).toHaveLength(3)
		expect(screen.queryByRole('heading')).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Return selected piece' }),
		).not.toBeInTheDocument()
		const tray = screen.getByRole('group', { name: 'Puzzle pieces' })
		expect(tray).toHaveTextContent('')
		expect(tray.querySelectorAll('span, small')).toHaveLength(0)
		expect(screen.getByRole('status')).toHaveClass('visually-hidden')
		const actions = screen.getByRole('button', {
			name: 'Restart',
		}).parentElement!
		expect(actions.querySelector('button')).toHaveAccessibleName(
			'Back to puzzle set',
		)
		expect(
			screen.getByRole('button', { name: 'Switch to light mode' })
				.parentElement,
		).toBe(actions)
		for (const svg of tray.querySelectorAll('svg')) {
			const [, , width, height] = svg
				.getAttribute('viewBox')!
				.split(' ')
				.map(Number)
			expect(svg).toHaveStyle({
				width: `${width}px`,
				height: `${height}px`,
			})
		}
		expect(screen.queryByText(/POC · Seed:/)).not.toBeInTheDocument()
		expect(
			screen
				.getByRole('group', { name: 'Puzzle pieces' })
				.querySelector('circle'),
		).not.toBeInTheDocument()
		expect(
			screen
				.getByRole('group', { name: 'Puzzle board' })
				.querySelectorAll(`.${styles.mutedMirrorCell}`),
		).toHaveLength(31)
	})

	it('solves by keyboard selection/placement and mirrors every placed tile', async () => {
		const user = userEvent.setup()
		renderPlaying()
		const board = screen.getByRole('group', { name: 'Puzzle board' })
		const wedgeTiles = Object.fromEntries(
			Object.keys(puzzle.target).map(key => [key, tileAt(key)]),
		)
		for (const [index, piece] of puzzle.pieces.entries()) {
			pieceButton(index).focus()
			await user.keyboard('{Enter}')
			const anchor = puzzle.solution[piece.id]
			tileAt(coordinateKey(anchor)).focus()
			await user.keyboard(' ')
			for (const cell of pieceCells(piece, anchor)) {
				expect(wedgeTiles[coordinateKey(cell)]).toHaveAttribute(
					'fill',
					cell.color,
				)
			}
		}
		expect(screen.getByRole('status')).toHaveTextContent('Puzzle solved!')
		expect(
			screen.getByRole('dialog', { name: 'Congrats!' }),
		).toBeInTheDocument()
		await user.click(
			screen.getByRole('button', { name: 'Close congratulations' }),
		)
		for (const [group, color] of Object.entries(puzzle.target)) {
			expect(wedgeTiles[group]).toHaveAttribute('fill', color)
		}
		expect(
			board.querySelectorAll('polygon[fill="var(--base)"]'),
		).toHaveLength(0)
		expect(
			board.querySelectorAll(`.${styles.mutedMirrorCell}`),
		).toHaveLength(0)
		expect(board.querySelectorAll('[data-piece-outline]')).toHaveLength(0)
		expect(board.querySelectorAll(`.${styles.wedgeCell}`)).toHaveLength(0)
		expect(
			board.querySelectorAll('[role="button"], [tabindex]'),
		).toHaveLength(0)
		const completedColors = [...board.querySelectorAll('polygon')].map(
			cell => cell.getAttribute('fill'),
		)
		const tile = wedgeTiles[Object.keys(puzzle.target)[0]]
		await user.click(tile)
		fireEvent.keyDown(tile, { key: 'Enter' })
		dragTo(tile, screen.getByRole('group', { name: 'Puzzle pieces' }))
		expect(
			document.querySelector(`.${styles.draggedPiece}`),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Return selected piece' }),
		).not.toBeInTheDocument()
		expect(
			[...board.querySelectorAll('polygon')].map(cell =>
				cell.getAttribute('fill'),
			),
		).toEqual(completedColors)
		expect(screen.getByRole('status')).toHaveTextContent('Puzzle solved!')
		await user.click(screen.getByRole('button', { name: 'Restart' }))
		expect(
			board.querySelectorAll(`.${styles.mutedMirrorCell}`),
		).toHaveLength(31)
		expect(board.querySelectorAll('[role="button"]')).toHaveLength(6)
	})

	it.each(['close button', 'backdrop', 'Escape'])(
		'keeps the solved puzzle after dismissing congratulations with %s',
		async method => {
			const user = userEvent.setup()
			renderPlaying()
			solvePuzzle()
			const dialog = screen.getByRole('dialog', { name: 'Congrats!' })
			if (method === 'close button') {
				await user.click(
					screen.getByRole('button', {
						name: 'Close congratulations',
					}),
				)
			} else if (method === 'backdrop') {
				fireEvent.click(dialog)
			} else {
				fireEvent(dialog, new Event('cancel', { cancelable: true }))
			}
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
			expect(screen.getByRole('status')).toHaveTextContent(
				'Puzzle solved!',
			)
			expect(targetColors()).toEqual(
				[
					...screen
						.getByRole('group', { name: 'Puzzle board' })
						.querySelectorAll('polygon'),
				].map(cell => cell.getAttribute('fill')),
			)
			await user.click(
				screen.getByRole('button', { name: 'Next puzzle' }),
			)
			expect(
				screen.getAllByRole('button', { name: /of 6, empty$/ }),
			).toHaveLength(6)
		},
	)

	it('starts a new blank puzzle from the congratulations dialog', async () => {
		const user = userEvent.setup()
		renderPlaying()
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		solvePuzzle()
		await user.click(screen.getByRole('button', { name: 'Next Puzzle' }))
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Next puzzle' }),
		).not.toBeInTheDocument()
		expect(
			screen.getAllByRole('button', { name: /of 6, empty$/ }),
		).toHaveLength(6)
	})

	it('accepts a fitting wrong placement, lets it be returned, and restarts', async () => {
		const user = userEvent.setup()
		renderPlaying()
		const singleIndex = puzzle.pieces.findIndex(
			piece => piece.tiles.length === 1,
		)
		const other = puzzle.pieces.find(piece => piece.tiles.length > 1)!
		await user.click(pieceButton(singleIndex))
		await user.click(tileAt(coordinateKey(puzzle.solution[other.id])))
		expect(pieceButton(singleIndex)).toHaveAccessibleName(/on board/)
		expect(screen.getByRole('status')).not.toHaveTextContent('solved')
		dragTo(
			tileAt(coordinateKey(puzzle.solution[other.id])),
			screen.getByRole('group', { name: 'Puzzle pieces' }),
		)
		expect(pieceButton(singleIndex)).toHaveAccessibleName(/in tray/)
		expect(pieceButton(singleIndex)).toBeEnabled()
		await user.click(pieceButton(singleIndex))
		await user.click(tileAt(coordinateKey(puzzle.solution[other.id])))
		await user.click(screen.getByRole('button', { name: 'Restart' }))
		expect(
			screen.getAllByRole('button', { name: /of 6, empty$/ }),
		).toHaveLength(6)
		expect(targetColors()).toEqual(
			// Restart preserves the original puzzle rather than generating another.
			generateHexagonCells(puzzle.gridSize).map(
				cell => puzzle.target[cell.groupId],
			),
		)
	})

	it.each(['mouse', 'touch'])(
		'supports dragging with %s, previews the drop, and returns pieces to the tray',
		pointerType => {
			renderPlaying()
			const piece = puzzle.pieces[0]
			const destination = tileAt(coordinateKey(puzzle.solution[piece.id]))
			dragTo(pieceButton(0), destination, pointerType)
			expect(pieceButton(0)).toHaveAccessibleName(/on board/)
			expect(destination).toHaveAttribute('fill', piece.tiles[0].color)
			dragTo(
				destination,
				screen.getByRole('group', { name: 'Puzzle pieces' }),
				pointerType,
			)
			expect(pieceButton(0)).toHaveAccessibleName(/in tray/)
			expect(destination).toHaveAttribute('fill', 'var(--base)')
		},
	)

	it('keeps an existing placement after an invalid drop or pointer cancellation', () => {
		renderPlaying()
		const piece = puzzle.pieces[0]
		const destination = tileAt(coordinateKey(puzzle.solution[piece.id]))
		dragTo(pieceButton(0), destination)
		dragTo(destination, null)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Drop onto a wedge tile',
		)
		expect(destination).toHaveAttribute('fill', piece.tiles[0].color)
		fireEvent.pointerDown(destination, {
			pointerId: 1,
			button: 0,
			clientX: 10,
			clientY: 10,
		})
		fireEvent.pointerCancel(destination, { pointerId: 1 })
		expect(screen.getByRole('status')).toHaveTextContent('Drag cancelled')
		expect(destination).toHaveAttribute('fill', piece.tiles[0].color)
	})

	it('rejects overlapping and outside-wedge placements with explicit feedback', async () => {
		const user = userEvent.setup()
		renderPlaying()
		const singleIndex = puzzle.pieces.findIndex(
			piece => piece.tiles.length === 1,
		)
		const multiIndex = puzzle.pieces.findIndex(
			piece => piece.tiles.length > 1,
		)
		const multi = puzzle.pieces[multiIndex]
		const anchor = tileAt(coordinateKey(puzzle.solution[multi.id]))
		await user.click(pieceButton(multiIndex))
		await user.click(anchor)
		await user.click(pieceButton(singleIndex))
		await user.click(anchor)
		expect(screen.getByRole('status')).toHaveTextContent(
			'overlaps another piece',
		)
		expect(pieceButton(singleIndex)).toHaveAccessibleName(/in tray/)
		await user.click(screen.getByRole('button', { name: 'Restart' }))
		await user.click(pieceButton(multiIndex))
		await user.click(anchor)
		const outsideAnchor = Object.keys(puzzle.target).find(key => {
			const [q, r] = key.split(',').map(Number)
			return pieceCells(multi, { q, r }).some(
				tile => !Object.hasOwn(puzzle.target, coordinateKey(tile)),
			)
		})!
		await user.click(anchor)
		await user.click(tileAt(outsideAnchor))
		expect(screen.getByRole('status')).toHaveTextContent(
			'inside the outlined wedge',
		)
		expect(anchor).toHaveAttribute('fill', multi.tiles[0].color)
	})

	it('disables placed tray pieces and outlines connected pieces without internal edges', async () => {
		const user = userEvent.setup()
		renderPlaying()
		const index = puzzle.pieces.findIndex(piece => piece.tiles.length === 2)
		const piece = puzzle.pieces[index]
		const anchor = tileAt(coordinateKey(puzzle.solution[piece.id]))
		await user.click(pieceButton(index))
		await user.click(anchor)
		expect(pieceButton(index)).toBeDisabled()
		expect(screen.queryByText('On board')).not.toBeInTheDocument()
		await user.click(pieceButton(index))
		expect(
			screen.queryByRole('button', { name: 'Return selected piece' }),
		).not.toBeInTheDocument()
		fireEvent.pointerDown(pieceButton(index), { pointerId: 1, button: 0 })
		hitTest.mockReturnValue(
			screen.getByRole('group', { name: 'Puzzle pieces' }),
		)
		fireEvent.pointerUp(pieceButton(index), {
			pointerId: 1,
			clientX: 100,
			clientY: 100,
		})
		expect(anchor).toHaveAttribute('fill', piece.tiles[0].color)
		const board = screen.getByRole('group', { name: 'Puzzle board' })
		const outline = board.querySelector(
			`[data-piece-outline="${piece.id}"]`,
		)!
		expect(
			outline.querySelector('path')?.getAttribute('d')?.match(/M /g),
		).toHaveLength(10)
		await user.click(anchor)
		expect(anchor).toHaveAttribute('aria-pressed', 'true')
		expect(anchor).toHaveAccessibleDescription(
			`Piece ${index + 1}. Double-click or double-tap to return to tray; keyboard: Delete or Backspace.`,
		)
		expect(outline).toHaveClass(styles.selectedOutline)
		dragTo(anchor, screen.getByRole('group', { name: 'Puzzle pieces' }))
		expect(pieceButton(index)).toBeEnabled()
		expect(
			board.querySelector('[data-piece-outline]'),
		).not.toBeInTheDocument()
	})

	it('preserves the grabbed tile offset when dragging a placed multi-tile piece', () => {
		renderPlaying()
		const index = puzzle.pieces.findIndex(piece => piece.tiles.length > 1)
		const piece = puzzle.pieces[index]
		const anchor = puzzle.solution[piece.id]
		dragTo(pieceButton(index), tileAt(coordinateKey(anchor)))
		const otherTile = pieceCells(piece, anchor)[1]
		const source = tileAt(coordinateKey(otherTile))
		dragTo(source, source)
		expect(pieceButton(index)).toHaveAccessibleName(/on board/)
		for (const cell of pieceCells(piece, anchor)) {
			expect(tileAt(coordinateKey(cell))).toHaveAttribute(
				'fill',
				cell.color,
			)
		}
	})

	it('drags an opaque piece under the pointer at board scale without a grid preview', () => {
		renderPlaying()
		const piece = puzzle.pieces[0]
		const source = pieceButton(0)
		const board = screen.getByRole('group', { name: 'Puzzle board' })
		Object.defineProperty(board, 'getScreenCTM', {
			value: () => ({ a: 2, b: 0 }),
		})
		const destination = tileAt(coordinateKey(puzzle.solution[piece.id]))
		hitTest.mockReturnValue(destination)
		fireEvent.pointerDown(source, {
			pointerId: 1,
			button: 0,
			clientX: 10,
			clientY: 10,
		})
		fireEvent.pointerMove(source, {
			pointerId: 1,
			clientX: 100,
			clientY: 100,
		})
		expect(board.querySelectorAll('polygon')).toHaveLength(37)
		const graphic = document.querySelector(`.${styles.draggedPiece}`)!
		expect(graphic).toHaveStyle({
			left: '99px',
			top: '99px',
			width: '2px',
			height: '2px',
		})
		expect(graphic).toHaveAttribute('viewBox', '-0.5 -0.5 1 1')
		expect(graphic.querySelectorAll('polygon')).toHaveLength(
			piece.tiles.length,
		)
		expect(destination).toHaveAttribute('fill', 'var(--base)')
		hitTest.mockReturnValue(null)
		fireEvent.pointerMove(source, {
			pointerId: 1,
			clientX: 150,
			clientY: 200,
		})
		expect(graphic).toHaveStyle({ left: '149px', top: '199px' })
		hitTest.mockReturnValue(destination)
		fireEvent.pointerUp(source, {
			pointerId: 2,
			clientX: 100,
			clientY: 100,
		})
		fireEvent.pointerUp(source, {
			pointerId: 1,
			clientX: 100,
			clientY: 100,
		})
		expect(pieceButton(0)).toHaveAccessibleName(/on board/)
		expect(board.querySelectorAll('polygon')).toHaveLength(37)
		expect(
			document.querySelector(`.${styles.draggedPiece}`),
		).not.toBeInTheDocument()
	})

	it('keeps progress while hidden and moves to the next puzzle in the set', async () => {
		const user = userEvent.setup()
		const view = renderPlaying()
		await user.click(pieceButton(0))
		await user.click(
			tileAt(coordinateKey(puzzle.solution[puzzle.pieces[0].id])),
		)
		view.rerender(<PuzzleMode hidden />)
		expect(
			screen.queryByRole('region', { name: 'Puzzle Mode' }),
		).not.toBeInTheDocument()
		view.rerender(<PuzzleMode />)
		expect(pieceButton(0)).toHaveAccessibleName(/on board/)
		await user.click(screen.getByRole('button', { name: 'Restart' }))
		solvePuzzle()
		await user.click(
			screen.getByRole('button', { name: 'Close congratulations' }),
		)
		await user.click(screen.getByRole('button', { name: 'Next puzzle' }))
		expect(
			screen.getAllByRole('button', { name: /of 6, empty$/ }),
		).toHaveLength(6)
		expect(
			screen.queryByRole('button', { name: 'Next puzzle' }),
		).not.toBeInTheDocument()
	})
})
