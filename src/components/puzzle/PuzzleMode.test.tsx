import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProvider } from '@/test/renderWithProvider'
import { colorSchemes } from '@/data/colorSchemes'
import { generateHexagonCells } from '@/shape-geometry/hexagonGrid'
import {
	coordinateKey,
	generateHexPuzzle,
	HEX_PUZZLE_RECIPES,
	pieceCells,
} from '@/puzzles/hexPuzzle'
import PuzzleMode from './PuzzleMode'
import styles from './PuzzleMode.module.css'

const seed = 'ui-puzzle'
const puzzle = generateHexPuzzle(seed, colorSchemes[1])
const originalHitTest = Object.getOwnPropertyDescriptor(
	document,
	'elementFromPoint',
)
const originalCapture = Object.getOwnPropertyDescriptor(
	Element.prototype,
	'setPointerCapture',
)
const hitTest = vi.fn<(x: number, y: number) => Element | null>()

function tileAt(key: string) {
	const tile = screen
		.getByRole('group', { name: 'Puzzle board' })
		.querySelector<SVGPolygonElement>(`[data-puzzle-cell="${key}"]`)
	if (!tile) throw new Error(`Missing puzzle tile ${key}`)
	return tile
}

function pieceButton(index: number) {
	return screen.getByRole('button', {
		name: new RegExp(`^Select piece ${index + 1},`),
	})
}

function dragTo(
	source: Element,
	destination: Element | null,
	pointerType = 'mouse',
) {
	hitTest.mockReturnValue(destination)
	fireEvent.pointerDown(source, {
		pointerId: 1,
		button: 0,
		clientX: 10,
		clientY: 10,
		pointerType,
	})
	fireEvent.pointerMove(source, {
		pointerId: 1,
		clientX: 100,
		clientY: 100,
		pointerType,
	})
	fireEvent.pointerUp(source, {
		pointerId: 1,
		clientX: 100,
		clientY: 100,
		pointerType,
	})
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
	it('places the playtest Restart beside the pieces and keeps feedback for screen readers only', () => {
		const preview = generateHexPuzzle(
			'preview-layout',
			colorSchemes[1],
			HEX_PUZZLE_RECIPES[0],
		)
		renderWithProvider(<PuzzleMode previewPuzzle={preview} />)
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
		renderWithProvider(<PuzzleMode previewPuzzle={rotated} />)
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
			renderWithProvider(<PuzzleMode previewPuzzle={rotated} />)
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
			renderWithProvider(<PuzzleMode previewPuzzle={rotated} />)
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

	it.each(['Delete', 'Backspace'])(
		'returns a focused board piece with %s',
		key => {
			renderWithProvider(<PuzzleMode initialSeed={seed} />)
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
		renderWithProvider(<PuzzleMode initialSeed={seed} />)
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

	beforeEach(() => {
		localStorage.clear()
		hitTest.mockReset().mockReturnValue(null)
		Object.defineProperty(document, 'elementFromPoint', {
			configurable: true,
			value: hitTest,
		})
		Object.defineProperty(Element.prototype, 'setPointerCapture', {
			configurable: true,
			value: vi.fn(),
		})
	})

	afterAll(() => {
		if (originalHitTest)
			Object.defineProperty(document, 'elementFromPoint', originalHitTest)
		else Reflect.deleteProperty(document, 'elementFromPoint')
		if (originalCapture)
			Object.defineProperty(
				Element.prototype,
				'setPointerCapture',
				originalCapture,
			)
		else Reflect.deleteProperty(Element.prototype, 'setPointerCapture')
	})

	it('loads and generates new puzzles without secure-context-only randomUUID', async () => {
		const user = userEvent.setup()
		const getRandomValues = vi.fn(crypto.getRandomValues.bind(crypto))
		vi.stubGlobal('crypto', {
			getRandomValues,
		})
		try {
			const initialRender = renderWithProvider(<PuzzleMode />)
			expect(getRandomValues).toHaveBeenCalledOnce()
			initialRender.unmount()
			renderWithProvider(<PuzzleMode initialSeed={seed} />)
			solvePuzzle()
			await user.click(
				screen.getByRole('button', { name: 'Close congratulations' }),
			)
			await user.click(
				screen.getByRole('button', { name: 'Next puzzle' }),
			)
			expect(getRandomValues).toHaveBeenCalledTimes(2)
			expect(
				screen.getAllByRole('button', { name: /of 6, empty$/ }),
			).toHaveLength(6)
		} finally {
			vi.unstubAllGlobals()
		}
	})

	it('shows the target, six blank wedge tiles, and three fixed-orientation pieces', () => {
		renderWithProvider(<PuzzleMode initialSeed={seed} />)
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
			'Switch to light mode',
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
		renderWithProvider(<PuzzleMode initialSeed={seed} />)
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
			renderWithProvider(<PuzzleMode initialSeed={seed} />)
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
		renderWithProvider(<PuzzleMode initialSeed={seed} />)
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
		renderWithProvider(<PuzzleMode initialSeed={seed} />)
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
			generateHexagonCells(puzzle.radius).map(
				cell => puzzle.target[cell.groupId],
			),
		)
	})

	it.each(['mouse', 'touch'])(
		'supports dragging with %s, previews the drop, and returns pieces to the tray',
		pointerType => {
			renderWithProvider(<PuzzleMode initialSeed={seed} />)
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
		renderWithProvider(<PuzzleMode initialSeed={seed} />)
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
		renderWithProvider(<PuzzleMode initialSeed={seed} />)
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
		renderWithProvider(<PuzzleMode initialSeed={seed} />)
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
		renderWithProvider(<PuzzleMode initialSeed={seed} />)
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
		renderWithProvider(<PuzzleMode initialSeed={seed} />)
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

	it('keeps progress while hidden and starts a new blank seeded puzzle on request', async () => {
		const user = userEvent.setup()
		const view = renderWithProvider(<PuzzleMode initialSeed={seed} />)
		await user.click(pieceButton(0))
		await user.click(
			tileAt(coordinateKey(puzzle.solution[puzzle.pieces[0].id])),
		)
		view.rerender(<PuzzleMode initialSeed={seed} hidden />)
		expect(
			screen.queryByRole('region', { name: 'Puzzle Mode' }),
		).not.toBeInTheDocument()
		view.rerender(<PuzzleMode initialSeed={seed} />)
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
