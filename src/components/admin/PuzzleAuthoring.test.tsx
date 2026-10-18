import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseClient } from '../../services/supabaseClient'
import {
	HEX_PUZZLE_RECIPES,
	coordinateKey,
	rotateCoordinate,
} from '../../puzzles/hexPuzzle'
import {
	generateAuthoredHexPuzzle,
	renderAuthoredHexPuzzle,
} from '../../puzzles/hexAuthoring'
import PuzzleAuthoring from './PuzzleAuthoring'

const seed = '00000001000000010000000100000001'

const palette = {
	id: 'test',
	name: 'Test palette',
	colors: ['#112233', '#223344', '#334455', '#445566', '#556677'] as const,
}
const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../services/supabaseClient', () => ({
	getSupabaseClient: () => ({ from: mocks.from }),
}))

const originalHitTest = Object.getOwnPropertyDescriptor(
	document,
	'elementFromPoint',
)
const originalCapture = Object.getOwnPropertyDescriptor(
	Element.prototype,
	'setPointerCapture',
)
afterEach(() => {
	vi.restoreAllMocks()
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

function setup(
	result = {
		data: [{ ...palette, colors: [...palette.colors] }],
		error: null as { message: string } | null,
	},
) {
	vi.spyOn(crypto, 'getRandomValues').mockImplementation(values => {
		if (!(values instanceof Uint32Array))
			throw new Error('Expected seed words')
		values.fill(1)
		return values
	})
	const order = vi.fn().mockResolvedValue(result)
	mocks.from.mockReset().mockReturnValue({ select: () => ({ order }) })
	const view = render(<PuzzleAuthoring client={getSupabaseClient()} />)
	return { ...view, order }
}

describe('admin puzzle lab', () => {
	it('shows palette swatches and applies a different palette to the current design', async () => {
		const second = {
			...palette,
			id: 'other',
			name: 'Other palette',
			colors: Array(5).fill('#abcdef'),
		}
		setup({
			data: [{ ...palette, colors: [...palette.colors] }, second],
			error: null,
		})
		const firstButton = await screen.findByRole('button', {
			name: 'Select the Test palette color palette',
		})
		expect(firstButton).toHaveAttribute('aria-pressed', 'true')
		const swatches = firstButton.querySelectorAll('[style]')
		expect(swatches).toHaveLength(5)
		for (const [index, swatch] of swatches.entries()) {
			expect(swatch).toHaveStyle({
				backgroundColor: palette.colors[index],
			})
		}
		expect(
			screen.queryByRole('combobox', { name: 'Palette' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('textbox', { name: 'Seed' }),
		).not.toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('button', { name: 'Randomize puzzle' }),
		)
		const secondButton = screen.getByRole('button', {
			name: 'Select the Other palette color palette',
		})
		fireEvent.click(secondButton)
		expect(secondButton).toHaveAttribute('aria-pressed', 'true')
		expect(firstButton).toHaveAttribute('aria-pressed', 'false')
		for (const cell of screen
			.getByRole('img', { name: 'Target design' })
			.querySelectorAll('polygon')) {
			expect(cell).toHaveAttribute('fill', '#abcdef')
		}
		expect(
			screen.getByText(`Palette: Other palette. Seed: ${seed}`),
		).toBeInTheDocument()
	})

	it('randomizes repeatedly, skips previewed seeds per recipe, and resets the playtest', async () => {
		setup()
		await screen.findByLabelText('Recipe')
		const randomize = screen.getByRole('button', {
			name: 'Randomize puzzle',
		})
		fireEvent.click(randomize)
		expect(
			screen.getByText(`Palette: Test palette. Seed: ${seed}`),
		).toBeInTheDocument()
		let attempt = 0
		vi.mocked(crypto.getRandomValues).mockImplementation(values => {
			if (!(values instanceof Uint32Array))
				throw new Error('Expected seed words')
			values.fill(attempt++ === 0 ? 1 : 2)
			return values
		})
		const firstPiece = screen.getByRole('button', {
			name: /^Select piece 1,/,
		})
		fireEvent.click(firstPiece)
		fireEvent.click(randomize)
		expect(attempt).toBe(2)
		expect(
			screen.getByText(
				'Palette: Test palette. Seed: 00000002000000020000000200000002',
			),
		).toBeInTheDocument()
		expect(screen.getByRole('status')).toHaveTextContent('Choose a piece')
		fireEvent.change(screen.getByLabelText('Recipe'), {
			target: { value: 'hard-medium' },
		})
		fireEvent.click(randomize)
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
		expect(
			screen.getByRole('heading', {
				name: HEX_PUZZLE_RECIPES.find(
					recipe => recipe.id === 'hard-medium',
				)!.label,
			}),
		).toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Recipe'), {
			target: { value: 'easy-small' },
		})
		fireEvent.click(randomize)
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Unable to generate a fresh puzzle seed',
		)
		expect(
			screen.getByRole('heading', {
				name: HEX_PUZZLE_RECIPES.find(
					recipe => recipe.id === 'hard-medium',
				)!.label,
			}),
		).toBeInTheDocument()
	})

	it.each(HEX_PUZZLE_RECIPES)(
		'generates and solves $label with keyboard-compatible controls and no writes',
		async recipe => {
			localStorage.setItem('lab-save-sentinel', 'unchanged')
			const write = vi.spyOn(Storage.prototype, 'setItem')
			const { unmount } = setup()
			fireEvent.change(await screen.findByLabelText('Recipe'), {
				target: { value: recipe.id },
			})
			fireEvent.click(
				screen.getByRole('button', {
					name: 'Randomize puzzle',
				}),
			)
			const puzzle = renderAuthoredHexPuzzle(
				generateAuthoredHexPuzzle(seed, palette.id, recipe),
				palette,
			)
			const board = screen.getByRole('group', { name: 'Puzzle board' })
			for (const [index, piece] of puzzle.pieces.entries()) {
				const button = screen.getByRole('button', {
					name: new RegExp(`^Select piece ${index + 1},`),
				})
				const taps = recipe.rotation
					? puzzle.solution[piece.id].rotation || 6
					: 1
				for (let i = 0; i < taps; i++) {
					fireEvent.click(button)
				}
				const tile = board.querySelector(
					`[data-puzzle-cell="${coordinateKey(puzzle.solution[piece.id])}"]`,
				)
				if (!tile) throw new Error('Missing solution tile')
				fireEvent.keyDown(tile, { key: 'Enter' })
			}
			expect(
				screen.getByText(
					'Playtest solved! No player progress recorded.',
				),
			).toBeInTheDocument()
			expect(
				screen.queryByRole('button', { name: 'Next puzzle' }),
			).not.toBeInTheDocument()
			expect(write).not.toHaveBeenCalled()
			expect(
				mocks.from.mock.calls.every(([table]) => table === 'palettes'),
			).toBe(true)
			fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
			expect(
				within(
					screen.getByRole('group', { name: 'Puzzle board' }),
				).getAllByRole('button', { name: /empty$/ }),
			).toHaveLength(Object.keys(puzzle.target).length)
			unmount()
			write.mockRestore()
		},
	)

	it('shows database errors and retries without falling back to local palettes', async () => {
		const { order } = setup({
			data: [],
			error: { message: 'Connection lost' },
		})
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Connection lost',
		)
		expect(screen.queryByLabelText('Recipe')).not.toBeInTheDocument()
		order.mockResolvedValue({ data: [palette], error: null })
		fireEvent.click(
			screen.getByRole('button', { name: 'Refresh palettes' }),
		)
		expect(
			await screen.findByRole('button', {
				name: 'Select the Test palette color palette',
			}),
		).toBeInTheDocument()
	})

	it('refreshes palette colors without changing the layout or resetting placements', async () => {
		const { order } = setup()
		await screen.findByLabelText('Recipe')
		fireEvent.click(
			screen.getByRole('button', { name: 'Randomize puzzle' }),
		)
		const puzzle = renderAuthoredHexPuzzle(
			generateAuthoredHexPuzzle(seed, palette.id, HEX_PUZZLE_RECIPES[0]),
			palette,
		)
		const first = puzzle.pieces[0]
		fireEvent.click(
			screen.getByRole('button', { name: /^Select piece 1,/ }),
		)
		const tile = screen
			.getByRole('group', { name: 'Puzzle board' })
			.querySelector(
				`[data-puzzle-cell="${coordinateKey(puzzle.solution[first.id])}"]`,
			)
		if (!tile) throw new Error('Missing solution tile')
		fireEvent.click(tile)
		order.mockResolvedValue({
			data: [{ ...palette, colors: Array(5).fill('#abcdef') }],
			error: null,
		})
		fireEvent.click(
			screen.getByRole('button', { name: 'Refresh palettes' }),
		)
		await screen.findByLabelText('Recipe')
		expect(
			screen.getByRole('button', { name: /^Select piece 1,.*on board$/ }),
		).toBeDisabled()
		expect(tile).toHaveAttribute('fill', '#abcdef')
		for (const cell of screen
			.getByRole('img', { name: 'Target design' })
			.querySelectorAll('polygon')) {
			expect(cell).toHaveAttribute('fill', '#abcdef')
		}
	})

	it('drags a rotated piece by a non-anchor tile, selects it on the board, and returns it to the tray', async () => {
		setup()
		fireEvent.change(await screen.findByLabelText('Recipe'), {
			target: { value: 'hard-medium' },
		})
		fireEvent.click(
			screen.getByRole('button', { name: 'Randomize puzzle' }),
		)
		const puzzle = renderAuthoredHexPuzzle(
			generateAuthoredHexPuzzle(
				seed,
				palette.id,
				HEX_PUZZLE_RECIPES.find(recipe => recipe.id === 'hard-medium')!,
			),
			palette,
		)
		const index = puzzle.pieces.findIndex(piece => piece.tiles.length > 1)
		const piece = puzzle.pieces[index]
		const button = screen.getByRole('button', {
			name: new RegExp(`^Select piece ${index + 1},`),
		})
		const solution = puzzle.solution[piece.id]
		for (let i = 0; i < (solution.rotation ?? 0); i++) {
			fireEvent.click(button)
		}
		const offset = rotateCoordinate(piece.tiles[1], solution.rotation ?? 0)
		const key = coordinateKey({
			q: solution.q + offset.q,
			r: solution.r + offset.r,
		})
		const destination = screen
			.getByRole('group', { name: 'Puzzle board' })
			.querySelector(`[data-puzzle-cell="${key}"]`)
		const source = button.querySelector('[data-piece-tile="1"]')
		if (!source || !destination) throw new Error('Missing drag tile')
		Object.defineProperty(document, 'elementFromPoint', {
			configurable: true,
			value: () => destination,
		})
		Object.defineProperty(Element.prototype, 'setPointerCapture', {
			configurable: true,
			value: vi.fn(),
		})
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
		fireEvent.pointerUp(source, {
			pointerId: 1,
			clientX: 100,
			clientY: 100,
		})
		expect(
			screen.getByRole('button', {
				name: new RegExp(`^Select piece ${index + 1},.*on board$`),
			}),
		).toBeDisabled()
		fireEvent.doubleClick(destination)
		expect(
			screen.getByRole('button', {
				name: new RegExp(`^Select piece ${index + 1},.*in tray$`),
			}),
		).toBeEnabled()
	})
})
