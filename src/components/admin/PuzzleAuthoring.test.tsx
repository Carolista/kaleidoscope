import { act, fireEvent, screen, within, waitFor } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@test/renderWithNavigationGuard'
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
import styles from './AdminPortal.module.css'
import fieldStyles from '../shared/FormField.module.css'

const seed = '00000001000000010000000100000001'

const palette = {
	id: 'test',
	name: 'Test palette',
	colors: ['#112233', '#223344', '#334455', '#445566', '#556677'] as const,
}
const mocks = vi.hoisted(() => ({
	from: vi.fn(),
	rpc: vi.fn(),
	seeds: vi.fn(),
}))
vi.mock('../../services/supabaseClient', () => ({
	getSupabaseClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}))
vi.mock('../../services/puzzleLibrary', () => ({
	loadPuzzleDrafts: async () => [],
}))
vi.mock('../../services/schemeSets', () => ({
	loadSchemeSets: async () => [],
	manageSchemeSet: vi.fn(),
	schemeSetLabels: {
		undecided: 'Undecided',
		core: 'Core',
		reward: 'Reward',
		paid: 'Pack',
	},
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
	startCreating = true,
) {
	vi.spyOn(crypto, 'getRandomValues').mockImplementation(values => {
		if (!(values instanceof Uint32Array))
			throw new Error('Expected seed words')
		values.fill(1)
		return values
	})
	const order = vi.fn().mockResolvedValue(result)
	mocks.seeds.mockReset().mockResolvedValue({ data: [], error: null })
	mocks.rpc
		.mockReset()
		.mockImplementation((_name, args) =>
			Promise.resolve({ data: args.p_id, error: null }),
		)
	mocks.from.mockReset().mockImplementation((table: string) => {
		if (table === 'palettes')
			return { select: () => ({ order: () => ({ range: order }) }) }
		if (
			[
				'starter_palettes',
				'palette_grants',
				'palette_corrections',
			].includes(table)
		)
			return {
				select: () => ({
					eq: () => Promise.resolve({ count: 0, error: null }),
				}),
			}
		const query = {
			eq: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			range: mocks.seeds,
		}
		return { select: () => query }
	})
	const view = render(<PuzzleAuthoring client={getSupabaseClient()} />)
	if (startCreating)
		fireEvent.click(screen.getByRole('button', { name: 'New puzzle' }))
	return { ...view, order }
}

async function randomize() {
	const button = screen.getByRole('button', { name: 'Randomize puzzle' })
	fireEvent.click(button)
	await waitFor(() => expect(button).toBeEnabled())
}

describe('admin puzzle lab', () => {
	it('announces palette loading once in the editor and offers retry after failure without claiming an empty catalog', async () => {
		const { order } = setup({
			data: [],
			error: { message: 'Catalog offline' },
		})
		expect(screen.getAllByRole('status')).toHaveLength(1)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Loading Supabase palettes...',
		)
		await screen.findByRole('alert')
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		expect(
			screen.queryByText(/No palettes available/),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Randomize puzzle' }),
		).toBeDisabled()
		order.mockResolvedValueOnce({ data: [palette], error: null })
		fireEvent.click(
			screen.getByRole('button', { name: 'Refresh palettes' }),
		)
		await screen.findByRole('button', {
			name: 'Select the Test palette color palette',
		})
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
		let finish!: (value: { data: readonly unknown[]; error: null }) => void
		mocks.seeds.mockReturnValueOnce(
			new Promise(resolve => {
				finish = resolve
			}),
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Randomize puzzle' }),
		)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Generating puzzle preview…',
		)
		expect(
			screen.getByRole('button', { name: 'Randomize puzzle' }),
		).toBeDisabled()
		await act(async () => {
			finish({ data: [], error: null })
		})
		expect(
			screen.queryByText('Generating puzzle preview…'),
		).not.toBeInTheDocument()
		expect(screen.getByRole('status')).toHaveTextContent(
			'Choose a piece to get started.',
		)
		expect(screen.getByRole('status').querySelector('img')).toBeNull()
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: 'Keep this preview' },
		})
		const preview = screen.getByRole('img', {
			name: 'Target design',
		}).innerHTML
		order.mockResolvedValueOnce({
			data: [],
			error: { message: 'Refresh offline' },
		})
		fireEvent.click(
			screen.getByRole('button', { name: 'Refresh palettes' }),
		)
		await screen.findByRole('alert')
		expect(
			screen.getByRole('img', { name: 'Target design' }).innerHTML,
		).toBe(preview)
		expect(
			screen.getByRole('button', { name: 'Randomize puzzle' }),
		).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Save Draft' }),
		).toBeDisabled()
		expect(screen.getByRole('status')).toHaveTextContent(
			'Choose a piece to get started.',
		)
	})
	it('opens palette management from the library and refreshes authoring swatches after a palette save', async () => {
		const row = {
			...palette,
			colors: [...palette.colors],
			revision: 1,
			published_at: null,
			release_at: null,
		}
		const { order } = setup({ data: [row], error: null }, false)
		fireEvent.click(screen.getByRole('button', { name: 'Manage palettes' }))
		fireEvent.click(
			await screen.findByRole('button', { name: 'Edit Test palette' }),
		)
		await screen.findByText(/No saved references/)
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: 'Revised palette' },
		})
		fireEvent.change(screen.getByLabelText('Color 1'), {
			target: { value: '#abcdef' },
		})
		const updated = {
			...row,
			name: 'Revised palette',
			revision: 2,
			colors: ['#abcdef', ...row.colors.slice(1)],
		}
		order.mockResolvedValue({ data: [updated], error: null })
		fireEvent.click(screen.getByRole('button', { name: 'Save palette' }))
		await screen.findByText('Saved "Revised palette" as a draft palette.')
		expect(mocks.rpc).toHaveBeenCalledWith('manage_palette_draft', {
			p_id: row.id,
			p_action: 'update',
			p_name: 'Revised palette',
			p_colors: updated.colors,
			p_expected_name: row.name,
			p_expected_colors: row.colors,
			p_expected_revision: 1,
		})
		fireEvent.click(screen.getByRole('button', { name: 'Back to puzzles' }))
		fireEvent.click(
			await screen.findByRole('button', { name: 'New puzzle' }),
		)
		const option = await screen.findByRole('button', {
			name: 'Select the Revised palette color palette',
		})
		expect(option.querySelector('[style]')).toHaveStyle({
			backgroundColor: '#abcdef',
		})
		expect(
			screen.queryByRole('button', {
				name: 'Select the Test palette color palette',
			}),
		).not.toBeInTheDocument()
		expect(mocks.rpc).toHaveBeenCalledTimes(1)
	})

	it('keeps a revised name for the next puzzle without renaming or resaving the saved preview', async () => {
		setup()
		await screen.findByRole('button', {
			name: 'Select the Test palette color palette',
		})
		await randomize()
		const name = screen.getByLabelText('Puzzle name')
		fireEvent.change(name, { target: { value: 'Puzzle 1' } })
		const save = screen.getByRole('button', { name: /save draft/i })
		fireEvent.click(save)
		await screen.findByText(/Saved "Puzzle 1"/)
		const original = screen.getByRole('img', {
			name: 'Target design',
		}).innerHTML
		expect(name).toBeEnabled()
		fireEvent.change(name, { target: { value: 'Puzzle 2' } })
		expect(save).toBeDisabled()
		fireEvent.submit(save.closest('form')!)
		expect(mocks.rpc).toHaveBeenCalledTimes(1)
		expect(
			screen.getByRole('img', { name: 'Target design' }).innerHTML,
		).toBe(original)
		const unload = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(unload)
		expect(unload.defaultPrevented).toBe(true)
		fireEvent.click(screen.getByRole('button', { name: 'Back to library' }))
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		expect(name).toHaveValue('Puzzle 2')
		mocks.seeds.mockResolvedValueOnce({
			data: null,
			error: { message: 'Seed read failed' },
		})
		await randomize()
		expect(name).toHaveValue('Puzzle 2')
		expect(save).toBeDisabled()
		vi.mocked(crypto.getRandomValues).mockImplementation(values => {
			if (!(values instanceof Uint32Array))
				throw new Error('Expected seed words')
			values.fill(2)
			return values
		})
		await randomize()
		expect(name).toHaveValue('Puzzle 2')
		expect(save).toBeEnabled()
		fireEvent.click(save)
		await screen.findByText(/Saved "Puzzle 2"/)
		expect(mocks.rpc).toHaveBeenCalledTimes(2)
		expect(mocks.rpc.mock.calls[1][1].p_name).toBe('Puzzle 2')
		expect(mocks.rpc.mock.calls[1][1].p_id).not.toBe(
			mocks.rpc.mock.calls[0][1].p_id,
		)
		vi.mocked(crypto.getRandomValues).mockImplementation(values => {
			if (!(values instanceof Uint32Array))
				throw new Error('Expected seed words')
			values.fill(3)
			return values
		})
		await randomize()
		expect(name).toHaveValue('')
		expect(save).toBeDisabled()
	})

	it('starts in the library and warns before discarding an unsaved new puzzle', async () => {
		setup(undefined, false)
		expect(
			screen.getByRole('heading', { name: 'Puzzle drafts' }),
		).toBeInTheDocument()
		expect(screen.queryByLabelText('Recipe')).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'New puzzle' }))
		await screen.findByLabelText('Recipe')
		await randomize()
		const unload = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(unload)
		expect(unload.defaultPrevented).toBe(true)
		fireEvent.click(screen.getByRole('button', { name: 'Back to library' }))
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('heading', { name: 'New puzzle' }),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		expect(
			screen.getByRole('heading', { name: 'Puzzle drafts' }),
		).toBeInTheDocument()
	})

	it('lets the next palette change after save without changing the saved preview or writing again', async () => {
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
		await screen.findByLabelText('Recipe')
		await randomize()
		const original = screen.getByRole('img', {
			name: 'Target design',
		}).innerHTML
		const metadataForm = screen.getByRole('form', {
			name: 'Save puzzle draft',
		})
		expect(
			metadataForm.querySelector(`.${styles.metadataForm}`)?.children,
		).toHaveLength(2)
		expect(document.querySelectorAll('form')).toHaveLength(1)
		expect(screen.getByLabelText('Puzzle name').parentElement).toHaveClass(
			fieldStyles.field,
		)
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: 'Saved design' },
		})
		fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
		await screen.findByText(/Saved "Saved design"/)
		const unload = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(unload)
		expect(unload.defaultPrevented).toBe(false)
		const nextPalette = screen.getByRole('button', {
			name: 'Select the Other palette color palette',
		})
		expect(nextPalette).toBeEnabled()
		fireEvent.click(nextPalette)
		expect(nextPalette).toHaveAttribute('aria-pressed', 'true')
		expect(
			screen.getByRole('img', { name: 'Target design' }).innerHTML,
		).toBe(original)
		expect(mocks.rpc).toHaveBeenCalledTimes(1)
		expect(
			screen.getByRole('button', { name: /save draft/i }),
		).toBeDisabled()
		vi.mocked(crypto.getRandomValues).mockImplementation(values => {
			if (!(values instanceof Uint32Array))
				throw new Error('Expected seed words')
			values.fill(2)
			return values
		})
		await randomize()
		for (const polygon of screen
			.getByRole('img', { name: 'Target design' })
			.querySelectorAll('polygon')) {
			expect(polygon).toHaveAttribute('fill', '#abcdef')
		}
	})

	it('shows pending save feedback after all editor content and removes it when saving finishes', async () => {
		setup()
		await screen.findByLabelText('Recipe')
		await randomize()
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: 'Save feedback' },
		})
		let finish!: (value: { data: string; error: null }) => void
		mocks.rpc.mockReturnValueOnce(
			new Promise(resolve => {
				finish = resolve
			}),
		)
		const target = screen.getByRole('img', { name: 'Target design' })
		const playtest = target.closest(`.${styles.playtest}`)!
		const save = screen.getByRole('button', { name: 'Save Draft' })
		fireEvent.click(save)
		const status = screen
			.getByText('Saving puzzle draft…')
			.closest('[role="status"]')!
		expect(playtest.nextElementSibling).toBe(status)
		expect(status.nextElementSibling).toBeNull()
		expect(save).toBeDisabled()
		await act(async () => {
			finish({ data: mocks.rpc.mock.calls[0][1].p_id, error: null })
		})
		expect(status).not.toBeInTheDocument()
		expect(target).toBeInTheDocument()
		expect(screen.getByText(/Saved "Save feedback"/)).toBeInTheDocument()
	})

	it.each(['collection', 'daily'] as const)(
		'saves the exact preview as an unpublished %s draft without saving playtest placements',
		async usage => {
			setup()
			await screen.findByLabelText('Recipe')
			await randomize()
			fireEvent.change(screen.getByLabelText('Puzzle name'), {
				target: { value: '  Sunset  ' },
			})
			fireEvent.change(screen.getByLabelText('Intended use'), {
				target: { value: usage },
			})
			fireEvent.click(
				screen.getByRole('button', { name: /^Select piece 1,/ }),
			)
			fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
			await screen.findByText(/Saved "Sunset"/)
			const puzzle = generateAuthoredHexPuzzle(
				seed,
				palette.id,
				HEX_PUZZLE_RECIPES[0],
			)
			expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
				'save_hex_puzzle_draft',
				{
					p_id: expect.any(String),
					p_name: 'Sunset',
					p_usage: usage,
					p_palette_id: palette.id,
					p_board_size: 'sm',
					p_rotation_allowed: false,
					p_difficulty: 'easy',
					p_definition: puzzle.definition,
					p_seed: seed,
					p_generator_version: 'hexagon-v2',
					p_known_solution: puzzle.knownSolution,
				},
			)
			expect(
				screen.getByRole('button', { name: /save draft/i }),
			).toBeDisabled()
			expect(screen.getByLabelText('Puzzle name')).toBeEnabled()
		},
	)

	it('preserves the preview and retries a failed save with the same request ID', async () => {
		setup()
		mocks.rpc.mockResolvedValueOnce({
			data: null,
			error: { message: 'Connection lost' },
		})
		await screen.findByLabelText('Recipe')
		await randomize()
		const target = screen.getByRole('img', { name: 'Target design' })
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: 'Retry me' },
		})
		const save = screen.getByRole('button', { name: /save draft/i })
		fireEvent.click(save)
		fireEvent.submit(save.closest('form')!)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Connection lost',
		)
		expect(mocks.rpc).toHaveBeenCalledTimes(1)
		expect(target).toBeInTheDocument()
		expect(save).toBeEnabled()
		fireEvent.click(save)
		await screen.findByText(/Saved "Retry me"/)
		expect(mocks.rpc.mock.calls[1][1]).toEqual(mocks.rpc.mock.calls[0][1])
	})

	it('does not generate when saved-seed lookup fails, and skips saved seeds after recovery', async () => {
		setup()
		await screen.findByLabelText('Recipe')
		mocks.seeds.mockResolvedValueOnce({
			data: null,
			error: { message: 'Offline' },
		})
		await randomize()
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Unable to check saved puzzle seeds: Offline',
		)
		expect(crypto.getRandomValues).not.toHaveBeenCalled()
		mocks.seeds.mockResolvedValue({ data: [{ seed }], error: null })
		let attempt = 0
		vi.mocked(crypto.getRandomValues).mockImplementation(values => {
			if (!(values instanceof Uint32Array))
				throw new Error('Expected seed words')
			values.fill(attempt++ === 0 ? 1 : 2)
			return values
		})
		await randomize()
		expect(attempt).toBe(2)
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
	})

	it('rejects blank names and saves the preview recipe and palette rather than an ungenerated recipe selection', async () => {
		const second = { ...palette, id: 'other', name: 'Other palette' }
		setup({
			data: [palette, second].map(value => ({
				...value,
				colors: [...value.colors],
			})),
			error: null,
		})
		await screen.findByLabelText('Recipe')
		await randomize()
		fireEvent.click(
			screen.getByRole('button', {
				name: 'Select the Other palette color palette',
			}),
		)
		fireEvent.change(screen.getByLabelText('Recipe'), {
			target: { value: 'super-hard-large' },
		})
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: '   ' },
		})
		const save = screen.getByRole('button', { name: /save draft/i })
		fireEvent.click(save)
		expect(save).toBeDisabled()
		fireEvent.submit(save.closest('form')!)
		expect(screen.getByRole('alert')).toHaveTextContent('Enter a name')
		expect(mocks.rpc).not.toHaveBeenCalled()
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: 'Recolored' },
		})
		fireEvent.click(save)
		await screen.findByText(/Saved "Recolored"/)
		expect(mocks.rpc.mock.calls[0][1]).toMatchObject({
			p_palette_id: 'other',
			p_board_size: 'sm',
			p_difficulty: 'easy',
			p_rotation_allowed: false,
		})
		vi.mocked(crypto.getRandomValues).mockImplementation(values => {
			if (!(values instanceof Uint32Array))
				throw new Error('Expected seed words')
			values.fill(2)
			return values
		})
		await randomize()
		expect(screen.getByLabelText('Puzzle name')).toHaveValue('')
		expect(save).toBeDisabled()
		expect(screen.queryByText(/Saved "Recolored"/)).not.toBeInTheDocument()
	})

	it('groups palette and refresh controls separately from recipe and randomize controls', async () => {
		setup()
		const recipe = await screen.findByLabelText('Recipe')
		const refresh = screen.getByRole('button', { name: 'Refresh palettes' })
		const picker = screen.getByRole('group', { name: 'Palette' })
		const randomize = screen.getByRole('button', {
			name: 'Randomize puzzle',
		})
		expect(refresh.parentElement).toHaveClass(styles.paletteHeading)
		expect(picker).toContainElement(refresh)
		expect(
			within(picker).getAllByText('Palette', { exact: true }),
		).toHaveLength(1)
		expect(recipe.parentElement?.parentElement).toHaveClass(
			styles.recipeControls,
		)
		expect(randomize.parentElement).toBe(
			recipe.parentElement?.parentElement,
		)
		expect(randomize.querySelector('svg')).toHaveAttribute(
			'data-icon',
			'wand-magic-sparkles',
		)
		expect(
			recipe.closest(`.${styles.draftControls}`)?.parentElement,
		).toHaveClass(styles.authoringForm)
		expect(screen.getByLabelText('Recipe')).toBeVisible()
	})

	it('shows all metadata before generation and enables saving only with a named puzzle', async () => {
		setup()
		await screen.findByRole('button', {
			name: 'Select the Test palette color palette',
		})
		const name = screen.getByLabelText('Puzzle name')
		const save = screen.getByRole('button', { name: /save draft/i })
		expect(name).toBeVisible()
		expect(screen.getByLabelText('Intended use')).toBeVisible()
		expect(save).toBeDisabled()
		fireEvent.change(name, { target: { value: 'Named before generation' } })
		expect(save).toBeDisabled()
		await randomize()
		expect(name).toHaveValue('Named before generation')
		expect(save).toBeEnabled()
		fireEvent.change(name, { target: { value: '   ' } })
		expect(save).toBeDisabled()
	})

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
		fireEvent.click(firstButton)
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
		await randomize()
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
		expect(screen.queryByText(/Seed:/)).not.toBeInTheDocument()
		expect(
			screen.queryByRole('heading', { level: 3 }),
		).not.toBeInTheDocument()
	})

	it('randomizes repeatedly, skips previewed seeds per recipe, and resets the playtest', async () => {
		setup()
		await screen.findByRole('button', {
			name: 'Select the Test palette color palette',
		})
		const randomize = screen.getByRole('button', {
			name: 'Randomize puzzle',
		})
		fireEvent.click(randomize)
		await waitFor(() => expect(randomize).toBeEnabled())
		expect(crypto.getRandomValues).toHaveBeenCalledTimes(1)
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
		await waitFor(() => expect(randomize).toBeEnabled())
		expect(attempt).toBe(2)
		expect(crypto.getRandomValues).toHaveBeenCalledTimes(3)
		expect(screen.getByRole('status')).toHaveTextContent('Choose a piece')
		fireEvent.change(screen.getByLabelText('Recipe'), {
			target: { value: 'hard-medium' },
		})
		fireEvent.click(randomize)
		await waitFor(() => expect(randomize).toBeEnabled())
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
		expect(
			screen.getByText(/Tap tray pieces to rotate/),
		).toBeInTheDocument()
		expect(screen.getByLabelText('Recipe')).toHaveValue('hard-medium')
		fireEvent.change(screen.getByLabelText('Recipe'), {
			target: { value: 'easy-small' },
		})
		fireEvent.click(randomize)
		await waitFor(() => expect(randomize).toBeEnabled())
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Unable to generate a fresh puzzle seed',
		)
		expect(
			screen.getByText(/Tap tray pieces to rotate/),
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
			await randomize()
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
			expect(mocks.rpc).not.toHaveBeenCalled()
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
		expect(screen.getByLabelText('Recipe')).toBeDisabled()
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
		await randomize()
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
		await randomize()
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
