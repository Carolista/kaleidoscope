import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProvider } from '@/test/renderWithProvider'
import { palettes, testContent } from '@/test/playerContent'
import type { PlayerContent } from '@/ui/content'
import { generateHexagonCells } from '@/domain/shapes/hexagon'
import { withLightness } from '@/domain/palettes'
import { coordinateKey, generatePuzzle, pieceCells } from '@/domain/puzzles'
import PuzzleMode from './PuzzleMode'
import styles from '@/ui/puzzle/PuzzleBoard.module.css'
import {
	dragTo,
	hitTest,
	markPuzzleIntrosSeen,
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
			kind: 'core',
			puzzles: [
				{
					id: 'p1',
					name: 'One',
					difficulty: 'easy',
					palette: palettes[1],
					puzzle,
				},
				{
					id: 'p2',
					name: 'Two',
					difficulty: 'moderate',
					palette: palettes[1],
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

	it("tints the session's icons from the puzzle's palette, not the zen palette", () => {
		renderPlaying()
		for (const name of ['Restart', 'Back to puzzle set']) {
			expect(
				screen
					.getByRole('button', { name })
					.querySelector('svg')
					?.style.getPropertyValue('--fa-secondary-color'),
			).toBe(withLightness(palettes[1].colors[1], 50))
		}
	})

	it('keeps Next puzzle in place, disabled until the puzzle is solved', async () => {
		const user = userEvent.setup()
		renderPlaying()
		expect(
			screen.getByRole('button', { name: 'Next puzzle' }),
		).toBeDisabled()
		solvePuzzle()
		const next = screen.getByRole('button', { name: 'Next puzzle' })
		expect(next).toBeEnabled()
		await user.click(next)
		expect(
			screen.getAllByRole('button', { name: /of 6, empty$/ }),
		).toHaveLength(6)
	})

	beforeEach(() => {
		localStorage.clear()
		markPuzzleIntrosSeen()
	})
	stubPointerHitTesting()

	it('lists the available sets with their progress and opens one as a numbered grid', async () => {
		const user = userEvent.setup()
		localStorage.setItem(
			'kaleidoscope:puzzle-progress',
			JSON.stringify({ version: 1, solved: ['p2', 'gone'] }),
		)
		renderBrowser()
		expect(
			screen.getByRole('heading', { name: 'Puzzle Sets' }),
		).toBeInTheDocument()
		const set = screen.getByRole('button', { name: /Starter/ })
		expect(set).toHaveTextContent('Basic')
		expect(set).toHaveTextContent('1 of 2')
		// No shape name or wording, just a preview and progress per difficulty.
		expect(set).not.toHaveTextContent(/Hexagon|solved/)
		expect(set.querySelectorAll('svg')).toHaveLength(2)
		expect(set).toHaveTextContent('0 of 1')
		expect(set).toHaveTextContent('1 of 1')
		await user.click(set)
		expect(screen.getByRole('heading', { name: 'Starter' })).toBeVisible()
		expect(
			screen
				.getAllByRole('heading', { level: 3 })
				.map(item => item.textContent),
		).toEqual(['Easy', 'Moderate'])
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
			screen.getByRole('heading', { name: 'Puzzle Sets' }),
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
			screen.getByRole('button', { name: 'Back to puzzle set' }),
		)
		expect(
			screen.getByRole('button', { name: 'Puzzle 1, Easy, solved' }),
		).toBeInTheDocument()
		view.unmount()
		renderBrowser()
		expect(
			screen.getByRole('button', { name: /Starter/ }),
		).toHaveTextContent('1 of 2')
	})

	it('finishes the set when no unsolved puzzle is left', async () => {
		const user = userEvent.setup()
		localStorage.setItem(
			'kaleidoscope:puzzle-progress',
			JSON.stringify({ version: 1, solved: ['p2'] }),
		)
		renderPlaying()
		solvePuzzle()
		expect(screen.getByRole('status')).toHaveTextContent('Puzzle solved!')
		expect(
			screen.queryByRole('button', { name: 'Next puzzle' }),
		).not.toBeInTheDocument()
		await user.click(
			screen.getByRole('button', { name: 'Back to puzzle set' }),
		)
		expect(screen.getByRole('heading', { name: 'Starter' })).toBeVisible()
	})

	it('hides a bonus set until its core set is complete, then announces and lists it', async () => {
		const user = userEvent.setup()
		const bonusContent: PlayerContent = {
			...content,
			puzzleSets: [
				...content.puzzleSets,
				{
					id: 'set-bonus',
					name: 'Extra',
					shape: 'hexagon',
					track: 'basic',
					kind: 'bonus',
					puzzles: [
						{
							id: 'bonus-1',
							name: 'Bonus',
							difficulty: 'easy',
							palette: palettes[1],
							puzzle: generatePuzzle('ui-bonus', palettes[1]),
						},
					],
				},
			],
			rewards: [
				{
					setId: 'set-one',
					palettes: [
						{ ...palettes[5], id: 'earned', name: 'Earned' },
					],
					bonusSetIds: ['set-bonus'],
				},
			],
		}
		localStorage.setItem(
			'kaleidoscope:puzzle-progress',
			JSON.stringify({ version: 1, solved: ['p2'] }),
		)
		renderWithProvider(<PuzzleMode />, bonusContent)
		expect(
			screen.queryByRole('button', { name: /Extra/ }),
		).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: /Starter/ }))
		fireEvent.click(screen.getByRole('button', { name: /^Puzzle 1,/ }))
		solvePuzzle()
		const reward = screen.getByRole('dialog', { name: 'Reward earned' })
		expect(reward).toHaveTextContent('Hooray!')
		expect(reward).toHaveTextContent('New palette unlocked:')
		expect(reward).toHaveTextContent('Earned')
		expect(reward).toHaveTextContent('New puzzle set unlocked:')
		expect(reward).toHaveTextContent('Extra')
		await user.click(
			screen.getByRole('button', { name: 'Go to puzzle set now' }),
		)
		expect(screen.getByRole('heading', { name: 'Extra' })).toBeVisible()
		await user.click(
			screen.getByRole('button', { name: 'All puzzle sets' }),
		)
		expect(screen.getByRole('button', { name: /Extra/ })).toHaveTextContent(
			'Basic bonus',
		)
	})

	it('sends the player to Zen Mode from a palette reward', async () => {
		const user = userEvent.setup()
		const onOpenZen = vi.fn()
		localStorage.setItem(
			'kaleidoscope:puzzle-progress',
			JSON.stringify({ version: 1, solved: ['p2'] }),
		)
		renderWithProvider(<PuzzleMode onOpenZen={onOpenZen} />, {
			...content,
			rewards: [
				{
					setId: 'set-one',
					palettes: [
						{ ...palettes[5], id: 'earned', name: 'Earned' },
					],
					bonusSetIds: [],
				},
			],
		})
		fireEvent.click(screen.getByRole('button', { name: /Starter/ }))
		fireEvent.click(screen.getByRole('button', { name: /^Puzzle 1,/ }))
		solvePuzzle()
		expect(
			screen.queryByText('New puzzle set unlocked:'),
		).not.toBeInTheDocument()
		await user.click(
			screen.getByRole('button', { name: 'Try it out in Zen Mode now' }),
		)
		expect(onOpenZen).toHaveBeenCalledOnce()
	})

	it('moves to the next puzzle in the set without repeating a solved one', async () => {
		const user = userEvent.setup()
		renderPlaying()
		solvePuzzle()
		await user.click(screen.getByRole('button', { name: 'Next puzzle' }))
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
		expect(screen.getByText('Congrats!')).toHaveAttribute(
			'aria-hidden',
			'true',
		)
		for (const [group, color] of Object.entries(puzzle.target)) {
			expect(wedgeTiles[group]).toHaveAttribute('fill', color)
		}
		expect(
			board.querySelectorAll('polygon[fill="var(--accent)"]'),
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

	it('shows a brief Congrats over the solved puzzle without a dialog, then starts a new blank puzzle', async () => {
		const user = userEvent.setup()
		renderPlaying()
		expect(screen.queryByText('Congrats!')).not.toBeInTheDocument()
		solvePuzzle()
		expect(screen.getByText('Congrats!')).toBeInTheDocument()
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(targetColors()).toEqual(
			[
				...screen
					.getByRole('group', { name: 'Puzzle board' })
					.querySelectorAll('polygon'),
			].map(cell => cell.getAttribute('fill')),
		)
		await user.click(screen.getByRole('button', { name: 'Next puzzle' }))
		expect(screen.queryByText('Congrats!')).not.toBeInTheDocument()
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
			expect(destination).toHaveAttribute('fill', 'var(--accent)')
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

	it('moves the selection to another placed piece when it is clicked', async () => {
		const user = userEvent.setup()
		renderPlaying()
		const [first, second] = puzzle.pieces
		for (const [index, piece] of [first, second].entries())
			dragTo(
				pieceButton(index),
				tileAt(coordinateKey(puzzle.solution[piece.id])),
			)
		const board = screen.getByRole('group', { name: 'Puzzle board' })
		const outlineOf = (id: string) =>
			board.querySelector(`[data-piece-outline="${id}"]`)
		await user.click(tileAt(coordinateKey(puzzle.solution[first.id])))
		expect(outlineOf(first.id)).toHaveClass(styles.selectedOutline)
		await user.click(tileAt(coordinateKey(puzzle.solution[second.id])))
		expect(outlineOf(second.id)).toHaveClass(styles.selectedOutline)
		expect(outlineOf(first.id)).not.toHaveClass(styles.selectedOutline)
	})

	it('draws the selected piece outline above the other pieces', async () => {
		const user = userEvent.setup()
		renderPlaying()
		const [first, second] = puzzle.pieces
		for (const [index, piece] of [first, second].entries())
			dragTo(
				pieceButton(index),
				tileAt(coordinateKey(puzzle.solution[piece.id])),
			)
		const board = screen.getByRole('group', { name: 'Puzzle board' })
		await user.click(tileAt(coordinateKey(puzzle.solution[first.id])))
		const drawn = [...board.querySelectorAll('[data-piece-outline]')]
		expect(drawn.at(-1)).toHaveAttribute('data-piece-outline', first.id)
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
		expect(destination).toHaveAttribute('fill', 'var(--accent)')
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
		await user.click(screen.getByRole('button', { name: 'Next puzzle' }))
		expect(
			screen.getAllByRole('button', { name: /of 6, empty$/ }),
		).toHaveLength(6)
		expect(
			screen.queryByRole('button', { name: 'Next puzzle' }),
		).not.toBeInTheDocument()
	})
})
