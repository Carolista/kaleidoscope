import {
	act,
	cleanup,
	fireEvent,
	screen,
	within,
	waitFor,
} from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseClient } from '@/lib/supabase'
import {
	PUZZLE_RECIPES,
	PUZZLE_SHAPE_IDS,
	PUZZLE_SHAPE_LABELS,
	coordinateKey,
	rotateCoordinate,
	generateAuthoredPuzzle,
	renderAuthoredPuzzle,
} from '@/domain/puzzles'
import { puzzleDraftArgs } from '@/features/admin/services'
import PuzzleAuthoring from './PuzzleAuthoring'
import { AdminWorkspace } from '@/features/admin/shell'
import { useNavigationGuard } from '@/ui/navigation'
import styles from './PuzzleDraftForm.module.css'
import playtestStyles from './PuzzlePlaytest.module.css'
import fieldStyles from '@/ui/components/FormField.module.css'

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
	paletteGroups: vi.fn(),
	drafts: vi.fn(),
}))
vi.mock('@/lib/supabase/supabaseClient', () => ({
	getSupabaseClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}))
vi.mock('@/features/admin/services/puzzleLibrary', () => ({
	loadPuzzleDrafts: async () => mocks.drafts(),
}))
vi.mock('@/features/admin/services/paletteGroups', () => ({
	loadPaletteGroups: () => mocks.paletteGroups(),
	managePaletteGroup: vi.fn(),
	paletteGroupPurposeLabels: {
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
beforeEach(() => {
	mocks.paletteGroups.mockReset().mockResolvedValue([])
	mocks.drafts.mockReset().mockReturnValue([])
})
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

// Mirrors AdminWorkspace: reselecting the Drafts tab remounts the lab.
function Harness() {
	const { requestNavigation } = useNavigationGuard()
	const [visit, setVisit] = useState(0)
	return (
		<>
			<button
				onClick={() => requestNavigation(() => setVisit(n => n + 1))}
			>
				Drafts tab
			</button>
			<PuzzleAuthoring key={visit} client={getSupabaseClient()} />
		</>
	)
}

function setup(
	result = {
		data: [{ ...palette, colors: [...palette.colors] }],
		error: null as { message: string } | null,
	},
	startCreating = true,
	workspace = false,
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
		if (['palette_grants', 'palette_corrections'].includes(table))
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
	const view = render(
		workspace ? (
			<AdminWorkspace client={getSupabaseClient()} />
		) : (
			<Harness />
		),
	)
	if (startCreating)
		fireEvent.click(screen.getByRole('button', { name: 'New puzzle' }))
	return { ...view, order }
}

async function randomize() {
	const button = screen.getByRole('button', { name: 'Randomize puzzle' })
	// Randomize stays disabled until the palette catalog loads; a click before
	// then is ignored and no preview is generated.
	await waitFor(() => expect(button).toBeEnabled())
	fireEvent.click(button)
	expect(button).toBeDisabled()
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
	it('opens palettes as a peer section and loads updated authoring swatches after a palette save', async () => {
		const row = {
			...palette,
			colors: [...palette.colors],
			revision: 1,
			published_at: null,
			release_at: null,
		}
		const { order } = setup({ data: [row], error: null }, false, true)
		fireEvent.click(
			within(
				screen.getByRole('navigation', { name: 'Admin sections' }),
			).getByRole('button', { name: 'Palettes' }),
		)
		fireEvent.click(
			within(
				screen.getByRole('navigation', { name: 'Palettes views' }),
			).getByRole('button', { name: 'Palettes' }),
		)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Edit Test palette' }),
		)
		await screen.findByText('Not used anywhere.')
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
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
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
		fireEvent.click(
			within(
				screen.getByRole('navigation', { name: 'Admin sections' }),
			).getByRole('button', { name: 'Puzzles' }),
		)
		fireEvent.click(
			within(
				screen.getByRole('navigation', { name: 'Puzzles views' }),
			).getByRole('button', { name: 'Puzzles' }),
		)
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
		fireEvent.click(screen.getByRole('button', { name: 'Drafts tab' }))
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
		fireEvent.click(screen.getByRole('button', { name: 'Drafts tab' }))
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
		).toHaveLength(1)
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
		const playtest = target.closest(`.${playtestStyles.playtest}`)!
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

	it('saves the exact preview as an unpublished draft without saving playtest placements', async () => {
		setup()
		await screen.findByLabelText('Recipe')
		await randomize()
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: '  Sunset  ' },
		})
		fireEvent.click(
			screen.getByRole('button', { name: /^Select piece 1,/ }),
		)
		fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
		await screen.findByText(/Saved "Sunset"/)
		const puzzle = generateAuthoredPuzzle(
			seed,
			palette.id,
			PUZZLE_RECIPES[0],
			'hexagon',
		)
		expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('save_puzzle_draft', {
			p_id: expect.any(String),
			p_name: 'Sunset',
			p_shape_id: 'hexagon',
			p_palette_id: palette.id,
			p_board_size: 'sm',
			p_rotation_allowed: false,
			p_difficulty: 'easy',
			p_definition: puzzle.definition,
			p_seed: seed,
			p_generator_version: 'hexagon-v2',
			p_known_solution: puzzle.knownSolution,
		})
		expect(
			screen.getByRole('button', { name: /save draft/i }),
		).toBeDisabled()
		expect(screen.getByLabelText('Puzzle name')).toBeEnabled()
	})

	it('authors and saves a triangle puzzle from the shape picker', async () => {
		setup()
		await screen.findByLabelText('Recipe')
		const shape = screen.getByLabelText('Shape')
		expect(shape).toHaveValue('hexagon')
		expect(
			within(shape)
				.getAllByRole('option')
				.map(option => option.textContent),
		).toEqual(PUZZLE_SHAPE_IDS.map(id => PUZZLE_SHAPE_LABELS[id]))
		fireEvent.change(shape, { target: { value: 'triangle' } })
		expect(
			screen.queryByRole('img', { name: 'Target design' }),
		).not.toBeInTheDocument()
		await randomize()
		const seedFilters = mocks.from.mock.results
			.map(result => result.value)
			.filter(value => 'select' in value)
			.flatMap(value => value.select().eq?.mock?.calls ?? [])
		expect(seedFilters).toContainEqual(['puzzles.shape_id', 'triangle'])
		const target = screen.getByRole('img', { name: 'Target design' })
		const tiles = [...target.querySelectorAll('polygon')]
		expect(tiles).toHaveLength(25)
		for (const tile of tiles)
			expect(tile.getAttribute('points')!.split(' ')).toHaveLength(3)
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: 'Triangle one' },
		})
		fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
		await screen.findByText(/Saved "Triangle one"/)
		const puzzle = generateAuthoredPuzzle(
			seed,
			palette.id,
			PUZZLE_RECIPES[0],
			'triangle',
		)
		expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
			'save_puzzle_draft',
			expect.objectContaining({
				p_shape_id: 'triangle',
				p_generator_version: 'triangle-v1',
				p_definition: puzzle.definition,
				p_known_solution: puzzle.knownSolution,
			}),
		)
		expect(puzzle.definition.geometry).toEqual({ size: 5 })
	})

	it('creates a puzzle inside the filtered group with its shape and appends it after saving', async () => {
		const member = generateAuthoredPuzzle(
			seed,
			palette.id,
			PUZZLE_RECIPES[0],
			'triangle',
		)
		const args = puzzleDraftArgs('member', 'Member', member)
		mocks.drafts.mockReturnValue([
			{
				row: {
					id: 'member',
					name: 'Member',
					shape_id: 'triangle',
					palette_id: palette.id,
					board_size: args.p_board_size,
					rotation_allowed: args.p_rotation_allowed,
					difficulty: args.p_difficulty,
					definition: args.p_definition,
					published_at: null,
					release_at: null,
				},
				assigned: true,
				groupId: 'group-t',
				groupName: 'Triangles',
				groupPosition: 1,
				groupPurpose: 'core',
				groupTrack: 'basic',
				puzzle: member,
			},
		])
		setup(undefined, false)
		const baseFrom = mocks.from.getMockImplementation()!
		const groupRow = {
			id: 'group-t',
			name: 'Triangles',
			purpose: 'core',
			track: 'basic',
			shape_id: 'triangle',
			selection_mode: 'any',
			published_at: null,
			release_at: null,
		}
		mocks.from.mockImplementation((table: string) => {
			if (table === 'puzzle_groups')
				return {
					select: () => ({
						is: () => ({
							order: () => ({
								range: () =>
									Promise.resolve({
										data: [groupRow],
										error: null,
									}),
							}),
						}),
					}),
				}
			if (table === 'puzzle_group_members')
				return {
					select: () => ({
						in: () => ({
							order: () => ({
								order: () => ({
									range: () =>
										Promise.resolve({
											data: [],
											error: null,
										}),
								}),
							}),
						}),
					}),
				}
			return baseFrom(table)
		})
		cleanup()
		render(
			<PuzzleAuthoring
				client={getSupabaseClient()}
				catalogStatus="assigned"
			/>,
		)
		await screen.findByRole('button', { name: 'Edit draft Member' })
		expect(
			screen.queryByRole('button', { name: 'New puzzle' }),
		).not.toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Show group'), {
			target: { value: 'group-t' },
		})
		fireEvent.click(
			await screen.findByRole('button', { name: 'New puzzle' }),
		)
		expect(
			screen.getByText('This puzzle will be added to "Triangles".'),
		).toBeInTheDocument()
		expect(screen.getByLabelText('Shape')).toHaveValue('triangle')
		expect(screen.getByLabelText('Shape')).toBeDisabled()
		expect(
			within(screen.getByLabelText('Recipe'))
				.getAllByRole('option')
				.map(option => option.textContent),
		).toEqual(PUZZLE_RECIPES.filter(r => !r.rotation).map(r => r.label))
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(await screen.findByLabelText('Show group')).toHaveValue(
			'group-t',
		)
		fireEvent.click(
			await screen.findByRole('button', { name: 'New puzzle' }),
		)
		expect(
			screen.getByText('This puzzle will be added to "Triangles".'),
		).toBeInTheDocument()
		await randomize()
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: 'Triangle two' },
		})
		fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
		await screen.findByText(
			/Saved "Triangle two" as an unpublished draft in "Triangles"/,
		)
		const saved = mocks.rpc.mock.calls.find(
			([name]) => name === 'save_puzzle_draft',
		)![1]
		expect(saved).toMatchObject({ p_shape_id: 'triangle' })
		expect(saved).not.toHaveProperty('p_usage')
		expect(mocks.rpc).toHaveBeenCalledWith('manage_puzzle_group', {
			p_id: 'group-t',
			p_action: 'append',
			p_puzzle_ids: [saved.p_id],
		})
	})

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
		expect(screen.getByLabelText('Shape')).toBeVisible()
		expect(screen.queryByLabelText('Intended use')).not.toBeInTheDocument()
		expect(save).toBeDisabled()
		fireEvent.change(name, { target: { value: 'Named before generation' } })
		expect(save).toBeDisabled()
		await randomize()
		expect(name).toHaveValue('Named before generation')
		expect(save).toBeEnabled()
		fireEvent.change(name, { target: { value: '   ' } })
		expect(save).toBeDisabled()
	})

	it('orders palettes by group and position, then unassigned palettes by name, and selects the first', async () => {
		const named = (id: string, name: string) => ({
			...palette,
			id,
			name,
			colors: [...palette.colors],
		})
		const group = (name: string, ids: string[]) => ({
			row: { id: name, name },
			purpose: 'core',
			members: ids.map(id => ({ id, name: id, colors: [] })),
		})
		mocks.paletteGroups.mockResolvedValue([
			group('Second group', ['zed', 'alpha']),
			group('First group', ['beta']),
		])
		setup({
			data: [
				named('alpha', 'Alpha'),
				named('beta', 'Beta'),
				named('loose', 'Loose'),
				named('zed', 'Zed'),
			],
			error: null,
		})
		const picker = await screen.findByRole('group', { name: 'Palette' })
		await waitFor(() =>
			expect(
				within(picker)
					.getAllByRole('button')
					.filter(button => button.textContent)
					.map(button => button.textContent),
			).toEqual(['Beta', 'Zed', 'Alpha', 'Loose']),
		)
		expect(
			within(picker).getByRole('button', {
				name: 'Select the Beta color palette',
			}),
		).toHaveAttribute('aria-pressed', 'true')
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
			screen.getByRole('region', { name: 'Puzzle Mode' }),
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
			screen.getByRole('region', { name: 'Puzzle Mode' }),
		).toBeInTheDocument()
	})

	it.each(PUZZLE_RECIPES)(
		'generates and solves $label with keyboard-compatible controls and no writes',
		async recipe => {
			localStorage.setItem('lab-save-sentinel', 'unchanged')
			const write = vi.spyOn(Storage.prototype, 'setItem')
			const { unmount } = setup()
			fireEvent.change(await screen.findByLabelText('Recipe'), {
				target: { value: recipe.id },
			})
			await randomize()
			const puzzle = renderAuthoredPuzzle(
				generateAuthoredPuzzle(seed, palette.id, recipe, 'hexagon'),
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
		const puzzle = renderAuthoredPuzzle(
			generateAuthoredPuzzle(
				seed,
				palette.id,
				PUZZLE_RECIPES[0],
				'hexagon',
			),
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
		const puzzle = renderAuthoredPuzzle(
			generateAuthoredPuzzle(
				seed,
				palette.id,
				PUZZLE_RECIPES.find(recipe => recipe.id === 'hard-medium')!,
				'hexagon',
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
