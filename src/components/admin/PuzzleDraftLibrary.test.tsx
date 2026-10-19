import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/test/renderWithNavigationGuard'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateAuthoredHexPuzzle } from '@/puzzles/hexAuthoring'
import { HEX_PUZZLE_RECIPES } from '@/puzzles/hexPuzzle'
import { puzzleDraftArgs } from '@/services/puzzleDrafts'
import type { LibraryDraft } from '@/services/puzzleLibrary'
import { getSupabaseClient } from '@/services/supabaseClient'
import styles from './AdminPortal.module.css'
import layoutStyles from './AdminLayout.module.css'
import iconStyles from '@/components/shared/IconButton.module.css'
import PuzzleDraftLibrary from './PuzzleDraftLibrary'
import { useNavigationGuard } from '@/ui/navigation'

const mocks = vi.hoisted(() => ({
	load: vi.fn(),
	edit: vi.fn(),
	remove: vi.fn(),
	bulk: vi.fn(),
	replace: vi.fn(),
	seeds: vi.fn(),
	loadSets: vi.fn(),
	manageSet: vi.fn(),
}))
vi.mock('@/services/puzzleSets', () => ({
	loadDraftSets: (...args: unknown[]) => mocks.loadSets(...args),
	manageDraftSet: (...args: unknown[]) => mocks.manageSet(...args),
	deleteDraftSet: vi.fn(),
}))
vi.mock('@/services/puzzleLibrary', () => ({
	loadPuzzleDrafts: (...args: unknown[]) => mocks.load(...args),
	editPuzzleDraft: (...args: unknown[]) => mocks.edit(...args),
	deletePuzzleDraft: (...args: unknown[]) => mocks.remove(...args),
	bulkPuzzleDrafts: (...args: unknown[]) => mocks.bulk(...args),
	replacePuzzleDraft: (...args: unknown[]) => mocks.replace(...args),
}))
vi.mock('@/services/supabaseClient', () => ({
	getSupabaseClient: () => ({
		from: () => {
			const query = {
				eq: vi.fn().mockReturnThis(),
				order: vi.fn().mockReturnThis(),
				range: mocks.seeds,
			}
			return { select: () => query }
		},
	}),
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
	collectionId: null,
	collectionName: null,
	collectionPosition: null,
	collectionKind: null,
	puzzle,
}
beforeEach(() => {
	vi.resetAllMocks()
	mocks.load.mockResolvedValue([draft])
	mocks.edit.mockResolvedValue(undefined)
	mocks.remove.mockResolvedValue(undefined)
	mocks.bulk.mockResolvedValue(undefined)
	mocks.replace.mockResolvedValue(undefined)
	mocks.seeds.mockResolvedValue({ data: [], error: null })
	mocks.loadSets.mockResolvedValue([
		{
			row: {
				id: 'set',
				name: 'First set',
				kind: 'core',
				shape_id: 'hexagon',
				selection_mode: 'any',
				published_at: null,
				release_at: null,
			},
			members: [],
		},
	])
	mocks.manageSet.mockResolvedValue(undefined)
})
afterEach(() => vi.restoreAllMocks())
// Mirrors AdminWorkspace: reselecting the Drafts tab remounts the library.
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
			<PuzzleDraftLibrary
				key={visit}
				client={getSupabaseClient()}
				palettes={[palette, other]}
			/>
		</>
	)
}
function setup() {
	return render(<Harness />)
}
async function open() {
	fireEvent.click(
		await screen.findByRole('button', { name: 'Edit draft Saved art' }),
	)
	return screen.getByRole('article', { name: 'Edit Saved art' })
}
describe('draft library', () => {
	it('shows pending save feedback after all edit content and removes it after a failed save', async () => {
		let fail!: (cause: Error) => void
		mocks.edit.mockReturnValueOnce(
			new Promise((_resolve, reject) => {
				fail = reject
			}),
		)
		setup()
		const editor = await open()
		const target = screen.getByRole('img', { name: 'Target design' })
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: 'Revised name' },
		})
		const save = screen.getByRole('button', { name: 'Save Changes' })
		fireEvent.click(save)
		const status = within(editor)
			.getByText('Saving puzzle draft…')
			.closest('[role="status"]')!
		expect(editor.lastElementChild).toBe(status)
		expect(status.previousElementSibling).toBe(
			screen.getByRole('button', { name: 'Delete draft' }),
		)
		expect(save).toBeDisabled()
		await act(async () => {
			fail(new Error('Save failed'))
		})
		expect(status).not.toBeInTheDocument()
		expect(target).toBeInTheDocument()
		expect(save).toBeEnabled()
		expect(screen.getByRole('alert')).toHaveTextContent('Save failed')
	})

	it('distinguishes initial and empty-library refresh reads and clears pending feedback on failure', async () => {
		let finish!: (drafts: readonly LibraryDraft[]) => void
		mocks.load.mockReturnValueOnce(
			new Promise(resolve => {
				finish = resolve
			}),
		)
		setup()
		expect(screen.getByRole('status')).toHaveTextContent(
			'Loading puzzle drafts...',
		)
		expect(screen.getByRole('status').querySelector('img')).toHaveAttribute(
			'aria-hidden',
			'true',
		)
		await act(async () => {
			finish([])
		})
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		let fail!: (cause: Error) => void
		mocks.load.mockReturnValueOnce(
			new Promise((_resolve, reject) => {
				fail = reject
			}),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Refresh drafts' }))
		expect(screen.getByRole('status')).toHaveTextContent(
			'Refreshing puzzle drafts…',
		)
		await act(async () => {
			fail(new Error('Drafts offline'))
		})
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		expect(screen.getByRole('alert')).toHaveTextContent('Drafts offline')
		expect(
			screen.queryByText('No drafts match this view.'),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Refresh drafts' }),
		).toBeEnabled()
	})
	it.each([
		['core', 'Core'],
		['reward', 'Reward'],
		['paid', 'Pack'],
	] as const)(
		'labels assigned %s cards as %s beside the set name',
		async (kind, label) => {
			mocks.load.mockResolvedValue([
				{
					...draft,
					assigned: true,
					collectionName: 'My set',
					collectionKind: kind,
				},
			])
			setup()
			expect(
				await screen.findByText(`${label} · My set`),
			).toBeInTheDocument()
		},
	)
	it('assigns selected puzzles to a draft set atomically, preserves failed selections, and shows membership after reload', async () => {
		setup()
		fireEvent.click(
			await screen.findByRole('checkbox', {
				name: 'Select draft Saved art',
			}),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Assign to set' }))
		const picker = await screen.findByLabelText('Draft set')
		const apply = screen.getByRole('button', { name: 'Assign puzzles' })
		expect(apply).toBeDisabled()
		fireEvent.change(picker, { target: { value: 'set' } })
		expect(mocks.manageSet).not.toHaveBeenCalled()
		mocks.manageSet.mockRejectedValueOnce(
			new Error('Puzzle assigned in another tab'),
		)
		fireEvent.click(apply)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Puzzle assigned in another tab',
		)
		expect(
			screen.getByRole('checkbox', { name: 'Select draft Saved art' }),
		).toBeChecked()
		expect(picker).toHaveValue('set')
		mocks.load.mockResolvedValue([
			{
				...draft,
				assigned: true,
				collectionName: 'First set',
				collectionKind: 'core',
			},
		])
		fireEvent.click(apply)
		fireEvent.click(apply)
		await screen.findByText('Assigned 1 draft to set.')
		expect(mocks.manageSet).toHaveBeenCalledTimes(2)
		expect(mocks.manageSet).toHaveBeenLastCalledWith(
			expect.anything(),
			'set',
			{ kind: 'append', puzzleIds: ['draft-id'] },
		)
		await screen.findByText(/Core · First set/)
		expect(
			screen.queryByRole('group', { name: 'Bulk draft actions' }),
		).not.toBeInTheDocument()
	})
	it('blocks assignment of daily or already assigned puzzles', async () => {
		mocks.load.mockResolvedValue([
			{ ...draft, row: { ...draft.row, usage: 'daily' } },
		])
		setup()
		fireEvent.click(
			await screen.findByRole('checkbox', {
				name: 'Select draft Saved art',
			}),
		)
		expect(
			screen.getByRole('button', { name: 'Assign to set' }),
		).toBeDisabled()
		mocks.load.mockResolvedValue([
			{
				...draft,
				assigned: true,
				collectionName: 'First set',
				collectionKind: 'core',
			},
		])
		fireEvent.click(screen.getByRole('button', { name: 'Refresh drafts' }))
		fireEvent.click(
			await screen.findByRole('checkbox', {
				name: 'Select draft Saved art',
			}),
		)
		expect(
			screen.getByRole('button', { name: 'Assign to set' }),
		).toBeDisabled()
	})
	it('surfaces set lookup failures without losing selected puzzles', async () => {
		mocks.loadSets.mockRejectedValueOnce(
			new Error('Set catalog unavailable'),
		)
		setup()
		fireEvent.click(
			await screen.findByRole('checkbox', {
				name: 'Select draft Saved art',
			}),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Assign to set' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Set catalog unavailable',
		)
		expect(
			screen.getByRole('button', { name: 'Assign puzzles' }),
		).toBeDisabled()
		expect(
			screen.getByRole('checkbox', { name: 'Select draft Saved art' }),
		).toBeChecked()
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		fireEvent.click(screen.getByRole('button', { name: 'Assign to set' }))
		await screen.findByLabelText('Draft set')
		expect(mocks.loadSets).toHaveBeenCalledTimes(2)
	})
	it('previews replacements without writes, excludes saved/previewed seeds, and saves the exact replacement under the existing ID', async () => {
		mocks.seeds.mockResolvedValue({
			data: [{ seed: '00000001000000010000000100000001' }],
			error: null,
		})
		const words = [1, 2, 2, 3]
		vi.spyOn(crypto, 'getRandomValues').mockImplementation(values => {
			if (!(values instanceof Uint32Array))
				throw new Error('Expected seed words')
			const word = words.shift()
			if (!word) throw new Error('Unexpected seed request')
			values.fill(word)
			return values
		})
		setup()
		await open()
		const target = screen.getByRole('img', {
			name: 'Target design',
		}).innerHTML
		const name = screen.getByLabelText('Puzzle name')
		fireEvent.change(name, { target: { value: 'Replacement name' } })
		fireEvent.change(screen.getByLabelText('Intended use'), {
			target: { value: 'daily' },
		})
		fireEvent.click(
			screen.getByRole('button', {
				name: 'Select the Other color palette',
			}),
		)
		fireEvent.change(screen.getByLabelText('Recipe'), {
			target: { value: 'hard-medium' },
		})
		const randomize = screen.getByRole('button', {
			name: 'Randomize puzzle',
		})
		fireEvent.click(randomize)
		fireEvent.click(randomize)
		await waitFor(() => expect(randomize).toBeEnabled())
		expect(mocks.seeds).toHaveBeenCalledTimes(1)
		expect(name).toHaveValue('Replacement name')
		expect(screen.getByLabelText('Intended use')).toHaveValue('daily')
		expect(
			screen.getByRole('img', { name: 'Target design' }).innerHTML,
		).not.toBe(target)
		expect(mocks.edit).not.toHaveBeenCalled()
		expect(mocks.replace).not.toHaveBeenCalled()
		fireEvent.click(randomize)
		await waitFor(() => expect(randomize).toBeEnabled())
		expect(words).toEqual([])
		fireEvent.click(screen.getByRole('button', { name: 'Drafts tab' }))
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		mocks.replace.mockRejectedValueOnce(new Error('Replacement failed'))
		const preview = screen.getByRole('img', {
			name: 'Target design',
		}).innerHTML
		const save = screen.getByRole('button', { name: 'Save Changes' })
		fireEvent.click(save)
		fireEvent.submit(save.closest('form')!)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Replacement failed',
		)
		expect(mocks.replace).toHaveBeenCalledOnce()
		expect(
			screen.getByRole('img', { name: 'Target design' }).innerHTML,
		).toBe(preview)
		const expected = generateAuthoredHexPuzzle(
			'00000003000000030000000300000003',
			other.id,
			HEX_PUZZLE_RECIPES[3],
		)
		expect(mocks.replace).toHaveBeenCalledWith(
			expect.anything(),
			draft.row.id,
			'Replacement name',
			'daily',
			expected,
		)
		// Changing the next recipe does not silently regenerate the pending design.
		fireEvent.change(screen.getByLabelText('Recipe'), {
			target: { value: 'easy-small' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
		await screen.findByRole('heading', { name: 'Puzzle drafts' })
		const unload = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(unload)
		expect(unload.defaultPrevented).toBe(false)
		expect(mocks.replace.mock.calls[1]).toEqual(mocks.replace.mock.calls[0])
		expect(mocks.edit).not.toHaveBeenCalled()
	})

	it('discards a replacement without writing and reopens the original stored design', async () => {
		setup()
		await open()
		const original = screen.getByRole('img', {
			name: 'Target design',
		}).innerHTML
		fireEvent.click(
			screen.getByRole('button', { name: 'Randomize puzzle' }),
		)
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Randomize puzzle' }),
			).toBeEnabled(),
		)
		const unload = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(unload)
		expect(unload.defaultPrevented).toBe(true)
		fireEvent.click(screen.getByRole('button', { name: 'Drafts tab' }))
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		await open()
		expect(
			screen.getByRole('img', { name: 'Target design' }).innerHTML,
		).toBe(original)
		expect(mocks.replace).not.toHaveBeenCalled()
		expect(mocks.edit).not.toHaveBeenCalled()
	})

	it('preserves the current design when seed lookup fails and still saves metadata normally', async () => {
		setup()
		await open()
		const original = screen.getByRole('img', {
			name: 'Target design',
		}).innerHTML
		mocks.seeds.mockResolvedValueOnce({
			data: null,
			error: { message: 'Seed lookup unavailable' },
		})
		fireEvent.click(
			screen.getByRole('button', { name: 'Randomize puzzle' }),
		)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Seed lookup unavailable',
		)
		expect(
			screen.getByRole('img', { name: 'Target design' }).innerHTML,
		).toBe(original)
		fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
		await screen.findByText('Draft changes saved.')
		expect(mocks.edit).toHaveBeenCalledOnce()
		expect(mocks.replace).not.toHaveBeenCalled()
	})
	it('keeps gallery controls fixed and places compact bulk icons alongside select all', async () => {
		setup()
		const refresh = screen.getByRole('button', { name: 'Refresh drafts' })
		expect(refresh).toHaveAttribute('title', 'Refresh drafts')
		expect(refresh.querySelector('svg')).toHaveAttribute(
			'data-icon',
			'rotate',
		)
		expect(refresh.parentElement).toHaveClass(layoutStyles.actions)
		const filter = screen.getByLabelText('Show drafts')
		expect(filter).toHaveAccessibleName('Show drafts')
		expect(screen.queryByText('Show drafts')).not.toBeInTheDocument()
		expect(filter.parentElement).toBe(refresh.parentElement)
		const selectAll = await screen.findByRole('checkbox', {
			name: 'Select all',
		})
		const row = selectAll.closest(`.${layoutStyles.selectionBar}`)
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
			expect(button).toHaveClass(iconStyles.button)
		}
		fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
		expect(selectAll.closest(`.${layoutStyles.selectionBar}`)).toBe(row)
		expect(filter.parentElement).toBe(refresh.parentElement)
	})
	it('offers compact palette refresh in the edit workspace only', async () => {
		const refresh = vi.fn()
		render(
			<PuzzleDraftLibrary
				client={getSupabaseClient()}
				palettes={[palette, other]}
				onRefreshPalettes={refresh}
			/>,
		)
		expect(
			screen.queryByRole('button', { name: 'Refresh palettes' }),
		).not.toBeInTheDocument()
		await open()
		expect(screen.getByLabelText('Recipe')).toHaveValue(puzzle.recipe.id)
		expect(
			screen.getByRole('button', { name: 'Randomize puzzle' }),
		).toBeEnabled()
		expect(document.querySelectorAll('form')).toHaveLength(1)
		expect(screen.getAllByText('Palette', { exact: true })).toHaveLength(1)
		const button = screen.getByRole('button', { name: 'Refresh palettes' })
		expect(button.parentElement).toHaveClass(styles.paletteHeading)
		fireEvent.click(button)
		expect(refresh).toHaveBeenCalledOnce()
		expect(
			screen.queryByRole('button', { name: 'Back to library' }),
		).not.toBeInTheDocument()
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
			screen.getByRole('checkbox', { name: 'Select all' }),
		).toBePartiallyChecked()
		expect(screen.queryByRole('article')).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
		expect(first).toBeChecked()
		expect(
			screen.getByRole('checkbox', { name: 'Select draft Daily art' }),
		).toBeChecked()
		expect(screen.queryByText(/selected\)/)).not.toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Show drafts'), {
			target: { value: 'daily' },
		})
		expect(
			screen.queryByRole('group', { name: 'Bulk draft actions' }),
		).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
		fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }))
		const confirmation = screen.getByRole('dialog', {
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
			screen.getByRole('dialog', { name: 'Confirm gallery deletion' }),
		).toHaveTextContent('Saved art')
		expect(mocks.bulk).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(
			screen.queryByRole('dialog', { name: 'Confirm gallery deletion' }),
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
		expect(screen.getByRole('status')).toHaveTextContent(
			'Updating puzzle palettes…',
		)
		expect(screen.getByRole('status').querySelector('img')).toHaveAttribute(
			'aria-hidden',
			'true',
		)
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
	it('hides card and bulk deletion for assigned drafts but allows bulk palette changes', async () => {
		mocks.load.mockResolvedValue([{ ...draft, assigned: true }])
		setup()
		await screen.findByRole('button', { name: 'Edit draft Saved art' })
		expect(
			screen.queryByRole('button', { name: 'Delete draft Saved art' }),
		).not.toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('checkbox', { name: 'Select draft Saved art' }),
		)
		expect(
			screen.queryByRole('button', { name: 'Delete selected' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Assign to set' }),
		).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Change palette' }),
		).toBeEnabled()
		fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
		expect(
			screen.getByRole('checkbox', { name: 'Select draft Saved art' }),
		).not.toBeChecked()
	})
	it('orders assigned drafts by set name, then set position, with daily drafts last', async () => {
		const inSet = (
			id: string,
			name: string,
			set: string,
			position: number,
		) => ({
			...draft,
			row: { ...draft.row, id, name },
			assigned: true,
			collectionId: set,
			collectionName: set,
			collectionPosition: position,
			collectionKind: 'core',
		})
		mocks.load.mockResolvedValue([
			{
				...draft,
				row: {
					...draft.row,
					id: 'd',
					name: 'Aardvark',
					usage: 'daily',
				},
				assigned: true,
			},
			inSet('b1', 'Apple', 'Beta', 1),
			inSet('a2', 'Apple', 'Alpha', 2),
			inSet('a1', 'Zebra', 'Alpha', 1),
		])
		render(
			<PuzzleDraftLibrary
				client={getSupabaseClient()}
				palettes={[palette, other]}
				catalogStatus="assigned"
			/>,
		)
		await screen.findByRole('button', { name: 'Edit draft Zebra' })
		expect(
			screen
				.getAllByRole('checkbox', { name: /^Select draft / })
				.map(box => box.getAttribute('aria-label')),
		).toEqual([
			'Select draft Zebra',
			'Select draft Apple',
			'Select draft Apple',
			'Select draft Aardvark',
		])
		expect(
			screen
				.getAllByRole('button', { name: /^Edit draft / })
				.map(button => button.closest('li')?.textContent),
		).toEqual([
			expect.stringContaining('Alpha'),
			expect.stringContaining('Alpha'),
			expect.stringContaining('Beta'),
			expect.anything(),
		])
	})
	it('isolates assigned drafts by set and offers no set filter for unassigned drafts', async () => {
		const inSet = (
			id: string,
			name: string,
			setId: string,
			set: string,
		) => ({
			...draft,
			row: { ...draft.row, id, name },
			assigned: true,
			collectionId: setId,
			collectionName: set,
			collectionKind: 'core',
		})
		mocks.load.mockResolvedValue([
			inSet('a', 'First art', 'set-b', 'Beta'),
			inSet('b', 'Second art', 'set-a', 'Alpha'),
			{
				...draft,
				row: {
					...draft.row,
					id: 'c',
					name: 'Daily art',
					usage: 'daily',
				},
				assigned: true,
			},
		])
		const view = render(
			<PuzzleDraftLibrary
				client={getSupabaseClient()}
				palettes={[palette, other]}
				catalogStatus="assigned"
			/>,
		)
		const filter = await screen.findByLabelText('Show set')
		expect(
			within(filter)
				.getAllByRole('option')
				.map(option => option.textContent),
		).toEqual(['All sets', 'No set', 'Alpha', 'Beta'])
		fireEvent.click(
			screen.getByRole('checkbox', { name: 'Select draft First art' }),
		)
		fireEvent.change(filter, { target: { value: 'set-a' } })
		expect(
			screen.getByRole('button', { name: 'Edit draft Second art' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Edit draft First art' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('group', { name: 'Bulk draft actions' }),
		).not.toBeInTheDocument()
		fireEvent.change(filter, { target: { value: 'none' } })
		expect(
			screen.getByRole('button', { name: 'Edit draft Daily art' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Edit draft Second art' }),
		).not.toBeInTheDocument()
		view.unmount()
		mocks.load.mockResolvedValue([draft])
		render(
			<PuzzleDraftLibrary
				client={getSupabaseClient()}
				palettes={[palette, other]}
				catalogStatus="drafts"
			/>,
		)
		await screen.findByRole('button', { name: 'Edit draft Saved art' })
		expect(screen.queryByLabelText('Show set')).not.toBeInTheDocument()
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
			screen.getByRole('button', { name: 'Randomize puzzle' }),
		).toBeEnabled()
		expect(
			within(editor)
				.getByRole('img', { name: 'Target design' })
				.querySelectorAll('polygon[fill="#112233"]').length,
		).toBeGreaterThan(0)
		expect(
			within(editor).getAllByRole('button', { name: /^Select piece/ }),
		).toHaveLength(puzzle.definition.pieces.length)
		fireEvent.click(screen.getByRole('button', { name: 'Drafts tab' }))
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
		fireEvent.change(screen.getByLabelText('Puzzle name'), {
			target: { value: 'Unsaved' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Drafts tab' }))
		expect(screen.getByLabelText('Puzzle name')).toHaveValue('Unsaved')
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
		await screen.findByText('Draft changes saved.')
		await screen.findByRole('heading', { name: 'Puzzle drafts' })
		const unload = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(unload)
		expect(unload.defaultPrevented).toBe(false)
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
	it('lets assigned drafts replace their design but not their intended use or deletion', async () => {
		mocks.load.mockResolvedValue([{ ...draft, assigned: true }])
		setup()
		await open()
		expect(screen.getByLabelText('Intended use')).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Delete draft' }),
		).toBeDisabled()
		const randomize = screen.getByRole('button', {
			name: 'Randomize puzzle',
		})
		fireEvent.click(randomize)
		await waitFor(() => expect(randomize).toBeEnabled())
		fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
		await screen.findByRole('heading', { name: 'Puzzle drafts' })
		expect(mocks.replace).toHaveBeenCalledWith(
			expect.anything(),
			draft.row.id,
			draft.row.name,
			draft.row.usage,
			expect.anything(),
		)
		expect(mocks.edit).not.toHaveBeenCalled()
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
