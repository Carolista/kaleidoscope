import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateAuthoredHexPuzzle } from '../../puzzles/hexAuthoring'
import { HEX_PUZZLE_RECIPES } from '../../puzzles/hexPuzzle'
import { puzzleDraftArgs } from '../../services/puzzleDrafts'
import type { LibraryDraft } from '../../services/puzzleLibrary'
import { getSupabaseClient } from '../../services/supabaseClient'
import styles from './AdminPortal.module.css'
import PuzzleDraftLibrary from './PuzzleDraftLibrary'

const mocks = vi.hoisted(() => ({
	load: vi.fn(),
	edit: vi.fn(),
	remove: vi.fn(),
	bulk: vi.fn(),
}))
vi.mock('../../services/puzzleLibrary', () => ({
	loadPuzzleDrafts: (...args: unknown[]) => mocks.load(...args),
	editPuzzleDraft: (...args: unknown[]) => mocks.edit(...args),
	deletePuzzleDraft: (...args: unknown[]) => mocks.remove(...args),
	bulkPuzzleDrafts: (...args: unknown[]) => mocks.bulk(...args),
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
	mocks.bulk.mockResolvedValue(undefined)
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
		await screen.findByRole('button', { name: 'Edit draft Saved art' }),
	)
	return screen.getByRole('article', { name: 'Edit Saved art' })
}
describe('draft library', () => {
	it('keeps gallery controls fixed and places compact bulk icons alongside select all', async () => {
		setup()
		const refresh = screen.getByRole('button', { name: 'Refresh drafts' })
		expect(refresh).toHaveAttribute('title', 'Refresh drafts')
		expect(refresh.querySelector('svg')).toHaveAttribute(
			'data-icon',
			'rotate',
		)
		expect(refresh.parentElement).toHaveClass(styles.galleryControls)
		const filter = screen.getByLabelText('Show drafts')
		expect(filter).toHaveAccessibleName('Show drafts')
		expect(screen.queryByText('Show drafts')).not.toBeInTheDocument()
		expect(filter.parentElement).toBe(refresh.parentElement)
		const selectAll = await screen.findByRole('checkbox', {
			name: 'Select all shown',
		})
		const row = selectAll.closest(`.${styles.selectionRow}`)
		expect(row).toBeInTheDocument()
		fireEvent.click(selectAll)
		const actions = screen.getByRole('group', {
			name: 'Bulk draft actions',
		})
		expect(actions.parentElement).toBe(row)
		for (const [label, icon] of [
			['Change palette', 'palette'],
			['Delete selected', 'trash-can'],
			['Clear selection', 'xmark'],
		]) {
			const button = within(actions).getByRole('button', { name: label })
			expect(button).toHaveAttribute('title', label)
			expect(button.querySelector('svg')).toHaveAttribute(
				'data-icon',
				icon,
			)
			expect(button).toHaveClass(styles.cardAction)
		}
		fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
		expect(selectAll.closest(`.${styles.selectionRow}`)).toBe(row)
		expect(filter.parentElement).toBe(refresh.parentElement)
	})
	it('offers compact palette refresh in the edit workspace only', async () => {
		const refresh = vi.fn()
		render(
			<PuzzleDraftLibrary
				client={getSupabaseClient()}
				palettes={[palette, other]}
				revision={0}
				onRefreshPalettes={refresh}
			/>,
		)
		expect(
			screen.queryByRole('button', { name: 'Refresh palettes' }),
		).not.toBeInTheDocument()
		await open()
		expect(screen.getByLabelText('Recipe')).toHaveValue(puzzle.recipe.label)
		expect(screen.getByLabelText('Recipe')).toHaveAttribute('readonly')
		expect(
			screen.queryByRole('button', { name: 'Randomize puzzle' }),
		).not.toBeInTheDocument()
		expect(document.querySelectorAll('form')).toHaveLength(1)
		expect(screen.getAllByText('Palette', { exact: true })).toHaveLength(1)
		const button = screen.getByRole('button', { name: 'Refresh palettes' })
		expect(button.parentElement).toHaveClass(styles.paletteHeading)
		fireEvent.click(button)
		expect(refresh).toHaveBeenCalledOnce()
		expect(
			screen.getByRole('button', { name: 'Back to library' }),
		).toHaveClass(styles.backLink)
	})
	it('selects only shown drafts, reports mixed selection, and clears hidden selections on filter changes', async () => {
		const daily = {
			...draft,
			row: {
				...draft.row,
				id: 'daily',
				name: 'Daily art',
				usage: 'daily',
			},
		}
		mocks.load.mockResolvedValue([draft, daily])
		setup()
		const first = await screen.findByRole('checkbox', {
			name: 'Select draft Saved art',
		})
		fireEvent.click(first)
		expect(
			screen.getByRole('checkbox', { name: 'Select all shown' }),
		).toBePartiallyChecked()
		expect(screen.queryByRole('article')).not.toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('checkbox', { name: 'Select all shown' }),
		)
		expect(first).toBeChecked()
		expect(
			screen.getByRole('checkbox', { name: 'Select draft Daily art' }),
		).toBeChecked()
		expect(screen.getByText('(2 drafts selected)')).toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Show drafts'), {
			target: { value: 'daily' },
		})
		expect(
			screen.queryByRole('group', { name: 'Bulk draft actions' }),
		).not.toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('checkbox', { name: 'Select all shown' }),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }))
		const confirmation = screen.getByRole('group', {
			name: 'Confirm gallery deletion',
		})
		expect(confirmation).toHaveTextContent('Daily art')
		expect(confirmation).not.toHaveTextContent('Saved art')
		mocks.load.mockResolvedValue([draft])
		fireEvent.click(
			within(confirmation).getByRole('button', {
				name: 'Confirm delete',
			}),
		)
		await waitFor(() =>
			expect(mocks.bulk).toHaveBeenCalledWith(
				expect.anything(),
				['daily'],
				{ kind: 'delete' },
			),
		)
		await screen.findByText('Deleted 1 draft.')
		expect(
			screen.queryByRole('group', { name: 'Bulk draft actions' }),
		).not.toBeInTheDocument()
	})
	it('confirms card deletion without opening the editor, and cancels without writes', async () => {
		setup()
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Delete draft Saved art',
			}),
		)
		expect(screen.queryByRole('article')).not.toBeInTheDocument()
		expect(
			screen.getByRole('group', { name: 'Confirm gallery deletion' }),
		).toHaveTextContent('Saved art')
		expect(mocks.bulk).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(
			screen.queryByRole('group', { name: 'Confirm gallery deletion' }),
		).not.toBeInTheDocument()
		expect(mocks.bulk).not.toHaveBeenCalled()
	})
	it('requires palette selection and Apply, preserves failed actions, and blocks duplicates while applying', async () => {
		setup()
		fireEvent.click(
			await screen.findByRole('checkbox', {
				name: 'Select draft Saved art',
			}),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Change palette' }))
		expect(
			screen.getByRole('button', { name: 'Apply palette' }),
		).toBeDisabled()
		fireEvent.click(
			screen.getByRole('button', {
				name: 'Apply Other to selected drafts',
			}),
		)
		expect(mocks.bulk).not.toHaveBeenCalled()
		mocks.bulk.mockRejectedValueOnce(
			new Error('A selected puzzle is now live'),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Apply palette' }))
		expect(await screen.findByRole('alert')).toHaveTextContent('now live')
		expect(
			screen.getByRole('checkbox', { name: 'Select draft Saved art' }),
		).toBeChecked()
		expect(
			screen.getByRole('button', {
				name: 'Apply Other to selected drafts',
			}),
		).toHaveAttribute('aria-pressed', 'true')
		let finish: (() => void) | undefined
		mocks.bulk.mockReturnValueOnce(
			new Promise<void>(resolve => {
				finish = resolve
			}),
		)
		const apply = screen.getByRole('button', { name: 'Apply palette' })
		fireEvent.click(apply)
		fireEvent.click(apply)
		expect(mocks.bulk).toHaveBeenCalledTimes(2)
		expect(
			screen.getByRole('button', { name: 'Edit draft Saved art' }),
		).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Refresh drafts' }),
		).toBeDisabled()
		expect(
			screen.getByRole('checkbox', { name: 'Select draft Saved art' }),
		).toBeDisabled()
		if (!finish) throw new Error('Action did not start')
		finish()
		await screen.findByText('Updated the palette for 1 draft.')
		expect(mocks.bulk).toHaveBeenLastCalledWith(
			expect.anything(),
			['draft-id'],
			{ kind: 'palette', paletteId: 'other' },
		)
	})
	it('blocks card and bulk deletion of assigned drafts but allows bulk palette changes', async () => {
		mocks.load.mockResolvedValue([{ ...draft, assigned: true }])
		setup()
		expect(
			await screen.findByRole('button', {
				name: 'Delete draft Saved art',
			}),
		).toBeDisabled()
		fireEvent.click(
			screen.getByRole('checkbox', { name: 'Select draft Saved art' }),
		)
		expect(
			screen.getByRole('button', { name: 'Delete selected' }),
		).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Change palette' }),
		).toBeEnabled()
		fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
		expect(
			screen.getByRole('checkbox', { name: 'Select draft Saved art' }),
		).not.toBeChecked()
	})
	it('shows thumbnails, filters intended use, and reopens the stored design for playtesting', async () => {
		setup()
		const thumbnail = await screen.findByRole('button', {
			name: 'Edit draft Saved art',
		})
		const card = thumbnail.closest('li')!
		expect(card.querySelectorAll('polygon').length).toBeGreaterThan(0)
		fireEvent.click(card.querySelector('svg[aria-label="Target design"]')!)
		expect(screen.queryByRole('article')).not.toBeInTheDocument()
		expect(thumbnail.querySelector('svg')).toHaveAttribute(
			'data-prefix',
			'fas',
		)
		expect(thumbnail.querySelector('svg')).toHaveAttribute(
			'data-icon',
			'pen-to-square',
		)
		expect(
			within(card)
				.getByRole('button', { name: 'Delete draft Saved art' })
				.querySelector('svg'),
		).toHaveAttribute('data-icon', 'trash-can')
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
		await screen.findByRole('button', { name: 'Edit draft Saved art' })
		fireEvent.change(screen.getByLabelText('Show drafts'), {
			target: { value: 'daily' },
		})
		expect(
			screen.queryByRole('button', { name: 'Edit draft Saved art' }),
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
			screen.getByRole('button', {
				name: 'Select the Other color palette',
			}),
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
		fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
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
			screen.getByRole('heading', { name: 'Puzzle drafts' }),
		).toBeInTheDocument()
		expect(screen.queryByRole('article')).not.toBeInTheDocument()
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
		const button = screen.getByRole('button', { name: 'Save Changes' })
		fireEvent.click(button)
		fireEvent.submit(button.closest('form')!)
		expect(mocks.edit).toHaveBeenCalledTimes(1)
		expect(button).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Back to library' }),
		).toBeDisabled()
		expect(
			screen.queryByRole('button', { name: 'Edit draft Saved art' }),
		).not.toBeInTheDocument()
		if (!finish) throw new Error('Save did not start')
		finish()
		await screen.findByText('Draft changes saved.')
		expect(
			screen.getByRole('heading', { name: 'Puzzle drafts' }),
		).toBeInTheDocument()
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
		fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
		await screen.findByText('Draft changes saved.')
		await screen.findByRole('heading', { name: 'Puzzle drafts' })
		const unload = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(unload)
		expect(unload.defaultPrevented).toBe(false)
		expect(confirm).toHaveBeenCalledOnce()
	})
	it('preserves edits on failure and surfaces database errors', async () => {
		setup()
		mocks.edit.mockRejectedValueOnce(new Error('Draft is now scheduled'))
		await open()
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: 'Keep my edit' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
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
			screen.getByRole('button', { name: 'Save Changes' }),
		).toBeEnabled()
	})
	it('shows load failures explicitly and supports retry', async () => {
		mocks.load.mockRejectedValueOnce(new Error('Network unavailable'))
		setup()
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Network unavailable',
		)
		fireEvent.click(screen.getByRole('button', { name: 'Refresh drafts' }))
		await screen.findByRole('button', { name: 'Edit draft Saved art' })
	})
})
