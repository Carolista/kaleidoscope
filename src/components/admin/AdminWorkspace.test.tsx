import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@test/renderWithNavigationGuard'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import type { CatalogScheme } from '../../services/colorSchemes'
import type { LibraryDraft } from '../../services/puzzleLibrary'
import type { DraftSet } from '../../services/puzzleSets'
import { generateAuthoredHexPuzzle } from '../../puzzles/hexAuthoring'
import { HEX_PUZZLE_RECIPES } from '../../puzzles/hexPuzzle'
import { puzzleDraftArgs } from '../../services/puzzleDrafts'
import AdminWorkspace from './AdminWorkspace'

const mocks = vi.hoisted(() => ({
	puzzles: vi.fn(),
	puzzleSets: vi.fn(),
	palettes: vi.fn(),
	paletteSets: vi.fn(),
	manageSet: vi.fn(),
}))
vi.mock('../../services/puzzleLibrary', async importOriginal => ({
	...(await importOriginal<typeof import('../../services/puzzleLibrary')>()),
	loadPuzzleDrafts: (...args: unknown[]) => mocks.puzzles(...args),
}))
vi.mock('../../services/puzzleSets', async importOriginal => ({
	...(await importOriginal<typeof import('../../services/puzzleSets')>()),
	loadDraftSets: (...args: unknown[]) => mocks.puzzleSets(...args),
	manageDraftSet: (...args: unknown[]) => mocks.manageSet(...args),
}))
vi.mock('../../services/colorSchemes', async importOriginal => ({
	...(await importOriginal<typeof import('../../services/colorSchemes')>()),
	loadColorSchemes: (...args: unknown[]) => mocks.palettes(...args),
}))
vi.mock('../../services/schemeSets', async importOriginal => ({
	...(await importOriginal<typeof import('../../services/schemeSets')>()),
	loadSchemeSets: (...args: unknown[]) => mocks.paletteSets(...args),
}))

const client = {} as SupabaseClient<Database>
const palette: CatalogScheme = {
	id: 'palette',
	name: 'Unassigned colors',
	colors: ['#112233', '#223344', '#334455', '#445566', '#556677'],
	revision: 1,
	published_at: null,
	release_at: null,
}
const puzzle = generateAuthoredHexPuzzle(
	'test',
	palette.id,
	HEX_PUZZLE_RECIPES[0],
)
const args = puzzleDraftArgs(
	'puzzle',
	'Unassigned design',
	'collection',
	puzzle,
)
const draft: LibraryDraft = {
	row: {
		id: args.p_id,
		name: args.p_name,
		usage: args.p_usage,
		shape_id: 'hexagon',
		palette_id: palette.id,
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
	collectionKind: null,
	puzzle,
}
const set: DraftSet = {
	row: {
		id: 'set',
		name: 'Design collection',
		kind: 'core',
		shape_id: 'hexagon',
		selection_mode: 'any',
		published_at: null,
		release_at: null,
	},
	preview: null,
	members: [
		{ puzzleId: 'a', name: 'First member', position: 1, preview: null },
		{ puzzleId: 'b', name: 'Second member', position: 2, preview: null },
	],
}

beforeEach(() => {
	vi.resetAllMocks()
	mocks.puzzleSets.mockResolvedValue([set])
	mocks.puzzles.mockResolvedValue([
		draft,
		{
			...draft,
			row: { ...draft.row, id: 'assigned', name: 'Assigned design' },
			assigned: true,
			collectionName: set.row.name,
			collectionKind: 'core',
		},
		{
			...draft,
			row: {
				...draft.row,
				id: 'prepared',
				name: 'Prepared design',
				release_at: '2099-01-01',
			},
		},
	])
	const assignedPalette = {
		...palette,
		id: 'assigned',
		name: 'Assigned colors',
	}
	mocks.palettes.mockResolvedValue([
		palette,
		assignedPalette,
		{
			...palette,
			id: 'scheduled',
			name: 'Scheduled colors',
			published_at: '2026-01-01',
			release_at: '2099-01-01',
		},
		{
			...palette,
			id: 'published',
			name: 'Published colors',
			published_at: '2026-01-01',
		},
	])
	mocks.paletteSets.mockResolvedValue([
		{
			row: {
				id: 'colors',
				name: 'Color collection',
				kind: 'core',
				published_at: null,
				release_at: null,
			},
			kind: 'core',
			members: [assignedPalette],
		},
	])
})

function choose(menu: string, label: string) {
	fireEvent.click(
		within(screen.getByRole('navigation', { name: menu })).getByRole(
			'button',
			{ name: label },
		),
	)
}

describe('admin workspace navigation', () => {
	it('defaults to puzzle sets and makes palettes a peer with their own sets default', async () => {
		render(<AdminWorkspace client={client} />)
		expect(
			await screen.findByRole('button', {
				name: 'Edit set Design collection',
			}),
		).toBeInTheDocument()
		expect(
			within(
				screen.getByRole('navigation', { name: 'Puzzles views' }),
			).getByRole('button', { name: 'Sets' }),
		).toHaveAttribute('aria-current', 'page')
		expect(mocks.palettes).not.toHaveBeenCalled()
		expect(
			screen.queryByRole('button', { name: 'Manage palettes' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Back to library' }),
		).not.toBeInTheDocument()
		choose('Admin sections', 'Palettes')
		expect(
			await screen.findByRole('button', {
				name: 'Edit set Color collection',
			}),
		).toBeInTheDocument()
		expect(
			within(
				screen.getByRole('navigation', { name: 'Palettes views' }),
			).getByRole('button', { name: 'Sets' }),
		).toHaveAttribute('aria-current', 'page')
		choose('Admin sections', 'Shapes')
		expect(
			screen.getByText('Shape management is not available yet.'),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('navigation', { name: 'Palettes views' }),
		).not.toBeInTheDocument()
		choose('Admin sections', 'Puzzles')
		expect(
			await screen.findByRole('button', {
				name: 'Edit set Design collection',
			}),
		).toBeInTheDocument()
	})

	it('separates unassigned puzzle drafts from assigned puzzles and exposes release placeholders', async () => {
		render(<AdminWorkspace client={client} />)
		choose('Puzzles views', 'Puzzles')
		expect(
			await screen.findByRole('button', {
				name: 'Edit draft Unassigned design',
			}),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', {
				name: 'Edit draft Assigned design',
			}),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', {
				name: 'Edit draft Prepared design',
			}),
		).not.toBeInTheDocument()
		choose('Puzzles status', 'Assigned')
		expect(
			await screen.findByRole('button', {
				name: 'Edit draft Assigned design',
			}),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', {
				name: 'Edit draft Unassigned design',
			}),
		).not.toBeInTheDocument()
		for (const label of ['Scheduled', 'Published']) {
			choose('Puzzles status', label)
			expect(
				screen.getByRole('heading', { name: `${label} puzzles` }),
			).toBeInTheDocument()
			expect(
				screen.getByText(/This catalog view is not available yet/),
			).toBeInTheDocument()
		}
		choose('Puzzles status', 'Drafts')
		expect(
			await screen.findByRole('button', {
				name: 'Edit draft Unassigned design',
			}),
		).toBeInTheDocument()
	})

	it('separates palette drafts and set assignments without leaking scheduled or published palettes', async () => {
		render(<AdminWorkspace client={client} />)
		choose('Admin sections', 'Palettes')
		choose('Palettes views', 'Palettes')
		expect(
			await screen.findByRole('button', {
				name: 'Edit Unassigned colors',
			}),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Edit Assigned colors' }),
		).not.toBeInTheDocument()
		expect(screen.queryByText('Scheduled colors')).not.toBeInTheDocument()
		expect(screen.queryByText('Published colors')).not.toBeInTheDocument()
		choose('Palettes status', 'Assigned')
		expect(
			await screen.findByRole('button', { name: 'Edit Assigned colors' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Edit Unassigned colors' }),
		).not.toBeInTheDocument()
		for (const label of ['Scheduled', 'Published']) {
			choose('Palettes status', label)
			expect(
				screen.getByRole('heading', { name: `${label} palettes` }),
			).toBeInTheDocument()
		}
		choose('Palettes views', 'Sets')
		expect(
			await screen.findByRole('button', {
				name: 'Edit set Color collection',
			}),
		).toBeInTheDocument()
		choose('Palettes views', 'Palettes')
		expect(
			await screen.findByRole('button', {
				name: 'Edit Unassigned colors',
			}),
		).toBeInTheDocument()
	})

	it('guards top-level navigation with a staged set order and keeps the editor mounted when canceled', async () => {
		render(<AdminWorkspace client={client} />)
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Edit set Design collection',
			}),
		)
		fireEvent.keyDown(
			screen.getByRole('button', { name: 'Reorder First member' }),
			{ key: 'End' },
		)
		choose('Admin sections', 'Palettes')
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		expect(screen.getByText('1. Second member')).toBeInTheDocument()
		choose('Puzzles views', 'Puzzles')
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		expect(
			await screen.findByRole('heading', { name: 'Puzzle drafts' }),
		).toBeInTheDocument()
		expect(mocks.manageSet).not.toHaveBeenCalled()
	})

	it('guards status changes from an unsaved palette and blocks section changes during set saves', async () => {
		render(<AdminWorkspace client={client} />)
		choose('Admin sections', 'Palettes')
		choose('Palettes views', 'Palettes')
		fireEvent.click(
			await screen.findByRole('button', { name: 'New palette' }),
		)
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: 'Keep my colors' },
		})
		choose('Palettes status', 'Assigned')
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		expect(screen.getByLabelText('Palette name')).toHaveValue(
			'Keep my colors',
		)
		choose('Admin sections', 'Puzzles')
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Edit set Design collection',
			}),
		)
		let finish!: () => void
		mocks.manageSet.mockReturnValueOnce(
			new Promise<void>(resolve => {
				finish = resolve
			}),
		)
		fireEvent.change(screen.getByLabelText('Set name'), {
			target: { value: 'Renamed collection' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		choose('Admin sections', 'Shapes')
		expect(
			screen.getByRole('dialog', { name: 'Operation in progress' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('heading', { name: 'Shapes' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('dialog', { name: 'Discard unsaved changes?' }),
		).not.toBeInTheDocument()
		await act(async () => finish())
	})
	it('returns to the list when the active tab is chosen again', async () => {
		render(<AdminWorkspace client={client} />)
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Edit set Design collection',
			}),
		)
		expect(screen.getByLabelText('Set name')).toBeInTheDocument()
		choose('Puzzles views', 'Sets')
		expect(
			await screen.findByRole('button', {
				name: 'Edit set Design collection',
			}),
		).toBeInTheDocument()
		expect(screen.queryByLabelText('Set name')).not.toBeInTheDocument()
		choose('Puzzles views', 'Puzzles')
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Edit draft Unassigned design',
			}),
		)
		expect(
			screen.queryByRole('button', {
				name: 'Edit draft Unassigned design',
			}),
		).not.toBeInTheDocument()
		choose('Puzzles status', 'Drafts')
		expect(
			await screen.findByRole('button', {
				name: 'Edit draft Unassigned design',
			}),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'New puzzle' }))
		expect(
			screen.getByRole('heading', { name: 'New puzzle' }),
		).toBeInTheDocument()
		choose('Puzzles status', 'Drafts')
		expect(
			await screen.findByRole('button', {
				name: 'Edit draft Unassigned design',
			}),
		).toBeInTheDocument()
	})
	it('reuses cached catalogs across navigation and refetches only on request', async () => {
		render(<AdminWorkspace client={client} />)
		await screen.findByRole('button', {
			name: 'Edit set Design collection',
		})
		choose('Puzzles views', 'Puzzles')
		await screen.findByRole('button', {
			name: 'Edit draft Unassigned design',
		})
		choose('Puzzles status', 'Assigned')
		choose('Puzzles status', 'Drafts')
		choose('Puzzles views', 'Sets')
		expect(
			screen.getByRole('button', { name: 'Edit set Design collection' }),
		).toBeInTheDocument()
		choose('Admin sections', 'Palettes')
		await screen.findByRole('button', {
			name: 'Edit set Color collection',
		})
		choose('Palettes views', 'Palettes')
		expect(
			screen.getByRole('button', { name: 'Edit Unassigned colors' }),
		).toBeInTheDocument()
		choose('Admin sections', 'Puzzles')
		expect(
			screen.getByRole('button', { name: 'Edit set Design collection' }),
		).toBeInTheDocument()
		expect(mocks.puzzleSets).toHaveBeenCalledOnce()
		expect(mocks.puzzles).toHaveBeenCalledOnce()
		expect(mocks.palettes).toHaveBeenCalledOnce()
		expect(mocks.paletteSets).toHaveBeenCalledOnce()
		fireEvent.click(screen.getByRole('button', { name: 'Refresh sets' }))
		await screen.findByRole('button', {
			name: 'Edit set Design collection',
		})
		expect(mocks.puzzleSets).toHaveBeenCalledTimes(2)
		expect(mocks.puzzles).toHaveBeenCalledOnce()
	})
})
