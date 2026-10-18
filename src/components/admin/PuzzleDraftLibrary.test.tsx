import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseClient } from '../../services/supabaseClient'
import { generateAuthoredHexPuzzle } from '../../puzzles/hexAuthoring'
import { HEX_PUZZLE_RECIPES } from '../../puzzles/hexPuzzle'
import { puzzleDraftArgs } from '../../services/puzzleDrafts'
import type { LibraryDraft } from '../../services/puzzleLibrary'
import PuzzleDraftLibrary from './PuzzleDraftLibrary'

const mocks = vi.hoisted(() => ({
	load: vi.fn(),
	edit: vi.fn(),
	remove: vi.fn(),
}))
vi.mock('../../services/puzzleLibrary', () => ({
	loadPuzzleDrafts: (...args: unknown[]) => mocks.load(...args),
	editPuzzleDraft: (...args: unknown[]) => mocks.edit(...args),
	deletePuzzleDraft: (...args: unknown[]) => mocks.remove(...args),
}))
vi.mock('../../services/supabaseClient', () => ({
	getSupabaseClient: () => ({}),
}))
const palette = {
	id: 'cabo',
	name: 'Cabo',
	colors: ['#112233', '#223344', '#334455', '#445566', '#556677'] as const,
}
const other = {
	...palette,
	id: 'other',
	name: 'Other',
	colors: ['#abcdef', '#abcdef', '#abcdef', '#abcdef', '#abcdef'] as const,
}
const puzzle = generateAuthoredHexPuzzle(
	'saved',
	palette.id,
	HEX_PUZZLE_RECIPES[1],
)
const args = puzzleDraftArgs('draft-id', 'Saved art', 'collection', puzzle)
const draft: LibraryDraft = {
	row: {
		id: args.p_id,
		name: args.p_name,
		usage: args.p_usage,
		shape_id: 'hexagon',
		palette_id: args.p_palette_id,
		board_size: args.p_board_size,
		rotation_allowed: args.p_rotation_allowed,
		difficulty: args.p_difficulty,
		definition: args.p_definition,
		published_at: null,
		release_at: null,
	},
	assigned: false,
	puzzle,
}
beforeEach(() => {
	vi.resetAllMocks()
	mocks.load.mockResolvedValue([draft])
	mocks.edit.mockResolvedValue(undefined)
	mocks.remove.mockResolvedValue(undefined)
})
afterEach(() => vi.restoreAllMocks())
function setup() {
	return render(
		<PuzzleDraftLibrary
			client={getSupabaseClient()}
			palettes={[palette, other]}
			revision={0}
		/>,
	)
}
async function open() {
	fireEvent.click(
		await screen.findByRole('button', { name: 'Open draft Saved art' }),
	)
	return screen.getByRole('article', { name: 'Edit Saved art' })
}
describe('draft library', () => {
	it('shows thumbnails, filters intended use, and reopens the stored design for playtesting', async () => {
		setup()
		const thumbnail = await screen.findByRole('button', {
			name: 'Open draft Saved art',
		})
		expect(thumbnail.querySelectorAll('polygon').length).toBeGreaterThan(0)
		const editor = await open()
		expect(
			screen.queryByRole('heading', { name: 'Puzzle drafts' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Randomize puzzle' }),
		).not.toBeInTheDocument()
		expect(
			within(editor)
				.getByRole('img', { name: 'Target design' })
				.querySelectorAll('polygon[fill="#112233"]').length,
		).toBeGreaterThan(0)
		expect(
			within(editor).getAllByRole('button', { name: /^Select piece/ }),
		).toHaveLength(puzzle.definition.pieces.length)
		fireEvent.click(screen.getByRole('button', { name: 'Back to library' }))
		await screen.findByRole('button', { name: 'Open draft Saved art' })
		fireEvent.change(screen.getByLabelText('Show drafts'), {
			target: { value: 'daily' },
		})
		expect(
			screen.queryByRole('button', { name: 'Open draft Saved art' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByText('No drafts match this view.'),
		).toBeInTheDocument()
	})
	it('recolors without resetting playtest selection and saves only editable metadata', async () => {
		setup()
		const editor = await open()
		fireEvent.click(
			within(editor).getByRole('button', { name: /^Select piece 1,/ }),
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Use Other for this draft' }),
		)
		expect(
			within(editor).getByRole('button', { name: /^Select piece 1,/ }),
		).toHaveAttribute('aria-pressed', 'true')
		for (const polygon of within(editor)
			.getByRole('img', { name: 'Target design' })
			.querySelectorAll('polygon')) {
			expect(polygon).toHaveAttribute('fill', '#abcdef')
		}
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: 'Renamed' },
		})
		fireEvent.change(screen.getByLabelText('Intended use'), {
			target: { value: 'daily' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
		await waitFor(() =>
			expect(mocks.edit).toHaveBeenCalledWith(
				expect.anything(),
				'draft-id',
				'Renamed',
				'other',
				'daily',
			),
		)
		await screen.findByText('Draft changes saved.')
		expect(
			screen.getByRole('heading', { name: 'Editing: Renamed' }),
		).toBeInTheDocument()
		expect(mocks.load).toHaveBeenCalledTimes(1)
		fireEvent.click(screen.getByRole('button', { name: 'Back to library' }))
		await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2))
	})
	it('blocks duplicate submissions and switching drafts during a mutation', async () => {
		let finish: (() => void) | undefined
		mocks.edit.mockReturnValue(
			new Promise<void>(resolve => {
				finish = resolve
			}),
		)
		setup()
		await open()
		const button = screen.getByRole('button', { name: 'Save changes' })
		fireEvent.click(button)
		fireEvent.submit(button.closest('form')!)
		expect(mocks.edit).toHaveBeenCalledTimes(1)
		expect(button).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Back to library' }),
		).toBeDisabled()
		expect(
			screen.queryByRole('button', { name: 'Open draft Saved art' }),
		).not.toBeInTheDocument()
		if (!finish) throw new Error('Save did not start')
		finish()
		await screen.findByText('Draft changes saved.')
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Back to library' }),
			).toBeEnabled(),
		)
	})
	it('warns before leaving unsaved metadata, but not after a successful save', async () => {
		setup()
		await open()
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: 'Unsaved' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Back to library' }))
		expect(screen.getByLabelText('Puzzle name')).toHaveValue('Unsaved')
		expect(confirm).toHaveBeenCalledOnce()
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
		await screen.findByText('Draft changes saved.')
		fireEvent.click(screen.getByRole('button', { name: 'Back to library' }))
		await screen.findByRole('heading', { name: 'Puzzle drafts' })
		expect(confirm).toHaveBeenCalledOnce()
	})
	it('preserves edits on failure and surfaces database errors', async () => {
		setup()
		mocks.edit.mockRejectedValueOnce(new Error('Draft is now scheduled'))
		await open()
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: 'Keep my edit' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Draft is now scheduled',
		)
		expect(screen.getByLabelText('Puzzle name')).toHaveValue('Keep my edit')
		expect(mocks.load).toHaveBeenCalledTimes(1)
	})
	it('requires confirmation for deletion, preserves failed deletes, and refreshes after success', async () => {
		setup()
		mocks.remove.mockRejectedValueOnce(new Error('Now assigned'))
		await open()
		fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }))
		expect(mocks.remove).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: 'Keep draft' }))
		expect(
			screen.queryByRole('button', { name: 'Confirm delete' }),
		).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }))
		fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Now assigned',
		)
		mocks.load.mockResolvedValue([])
		fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
		await screen.findByText('No drafts match this view.')
		expect(mocks.remove).toHaveBeenCalledTimes(2)
		expect(screen.queryByRole('article')).not.toBeInTheDocument()
	})
	it('disables intended-use changes and deletion for assigned drafts', async () => {
		mocks.load.mockResolvedValue([{ ...draft, assigned: true }])
		setup()
		await open()
		expect(screen.getByLabelText('Intended use')).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Delete draft' }),
		).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Save changes' }),
		).toBeEnabled()
	})
	it('shows load failures explicitly and supports retry', async () => {
		mocks.load.mockRejectedValueOnce(new Error('Network unavailable'))
		setup()
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Network unavailable',
		)
		fireEvent.click(screen.getByRole('button', { name: 'Refresh drafts' }))
		await screen.findByRole('button', { name: 'Open draft Saved art' })
	})
})
