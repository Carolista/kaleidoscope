import { act, fireEvent, screen, within } from '@testing-library/react'
import {
	renderWithNavigationGuard as render,
	clickWhenEnabled,
} from '@/features/admin/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import type {
	CatalogPalette,
	LibraryDraft,
	PuzzleGroup,
} from '@/features/admin/services'
import { generateAuthoredPuzzle, PUZZLE_RECIPES } from '@/domain/puzzles'
import { puzzleDraftArgs } from '@/features/admin/services'
import AdminWorkspace from './AdminWorkspace'

const mocks = vi.hoisted(() => ({
	puzzles: vi.fn(),
	puzzleGroups: vi.fn(),
	palettes: vi.fn(),
	paletteGroups: vi.fn(),
	manageGroup: vi.fn(),
}))
vi.mock('@/features/admin/services/puzzleLibrary', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/puzzleLibrary')
	>()),
	loadPuzzleDrafts: (...args: unknown[]) => mocks.puzzles(...args),
}))
vi.mock('@/features/admin/services/puzzleGroups', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/puzzleGroups')
	>()),
	loadPuzzleGroups: (...args: unknown[]) => mocks.puzzleGroups(...args),
	managePuzzleGroup: (...args: unknown[]) => mocks.manageGroup(...args),
}))
vi.mock('@/features/admin/services/palettes', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/palettes')
	>()),
	loadPalettes: (...args: unknown[]) => mocks.palettes(...args),
}))
vi.mock('@/features/admin/services/paletteGroups', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/paletteGroups')
	>()),
	loadPaletteGroups: (...args: unknown[]) => mocks.paletteGroups(...args),
}))

const client = {} as SupabaseClient<Database>
const palette: CatalogPalette = {
	id: 'palette',
	name: 'Unassigned colors',
	colors: ['#112233', '#223344', '#334455', '#445566', '#556677'],
	revision: 1,
	published_at: null,
	release_at: null,
}
const puzzle = generateAuthoredPuzzle(
	'test',
	palette.id,
	PUZZLE_RECIPES[0],
	'hexagon',
)
const args = puzzleDraftArgs('puzzle', 'Unassigned design', puzzle)
const draft: LibraryDraft = {
	row: {
		id: args.p_id,
		name: args.p_name,
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
	groupId: null,
	groupName: null,
	groupPosition: null,
	groupPurpose: null,
	groupTrack: null,
	puzzle,
}
const group: PuzzleGroup = {
	row: {
		id: 'group',
		name: 'Design collection',
		purpose: 'core',
		track: 'basic',
		shape_id: 'hexagon',
		selection_mode: 'any',
		published_at: null,
		release_at: null,
	},
	purpose: 'core',
	track: 'basic',
	preview: null,
	members: [
		{ puzzleId: 'a', name: 'First member', position: 1, preview: null },
		{ puzzleId: 'b', name: 'Second member', position: 2, preview: null },
	],
}

beforeEach(() => {
	vi.resetAllMocks()
	mocks.puzzleGroups.mockResolvedValue([group])
	mocks.puzzles.mockResolvedValue([
		draft,
		{
			...draft,
			row: { ...draft.row, id: 'assigned', name: 'Assigned design' },
			assigned: true,
			groupId: group.row.id,
			groupName: group.row.name,
			groupPurpose: 'core',
			groupTrack: 'basic',
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
	mocks.paletteGroups.mockResolvedValue([
		{
			row: {
				id: 'colors',
				name: 'Color collection',
				purpose: 'core',
				published_at: null,
				release_at: null,
			},
			purpose: 'core',
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
	it('defaults to puzzle groups and makes palettes a peer with their own groups default', async () => {
		render(<AdminWorkspace client={client} />)
		expect(
			await screen.findByRole('button', {
				name: 'Edit group Design collection',
			}),
		).toBeInTheDocument()
		expect(
			within(
				screen.getByRole('navigation', { name: 'Puzzles views' }),
			).getByRole('button', { name: 'Groups' }),
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
				name: 'Edit group Color collection',
			}),
		).toBeInTheDocument()
		expect(
			within(
				screen.getByRole('navigation', { name: 'Palettes views' }),
			).getByRole('button', { name: 'Groups' }),
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
				name: 'Edit group Design collection',
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
		choose('Puzzles status', 'Unassigned')
		expect(
			await screen.findByRole('button', {
				name: 'Edit draft Unassigned design',
			}),
		).toBeInTheDocument()
	})

	it('separates palette drafts and group assignments without leaking scheduled or published palettes', async () => {
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
		choose('Palettes views', 'Groups')
		expect(
			await screen.findByRole('button', {
				name: 'Edit group Color collection',
			}),
		).toBeInTheDocument()
		choose('Palettes views', 'Palettes')
		expect(
			await screen.findByRole('button', {
				name: 'Edit Unassigned colors',
			}),
		).toBeInTheDocument()
	})

	it('guards top-level navigation with a staged group order and keeps the editor mounted when canceled', async () => {
		render(<AdminWorkspace client={client} />)
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Edit group Design collection',
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
		expect(mocks.manageGroup).not.toHaveBeenCalled()
	})

	it('guards status changes from an unsaved palette and blocks section changes during group saves', async () => {
		render(<AdminWorkspace client={client} />)
		choose('Admin sections', 'Palettes')
		choose('Palettes views', 'Palettes')
		await clickWhenEnabled('New palette')
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
				name: 'Edit group Design collection',
			}),
		)
		let finish!: () => void
		mocks.manageGroup.mockReturnValueOnce(
			new Promise<void>(resolve => {
				finish = resolve
			}),
		)
		fireEvent.change(screen.getByLabelText('Group name'), {
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
				name: 'Edit group Design collection',
			}),
		)
		expect(screen.getByLabelText('Group name')).toBeInTheDocument()
		choose('Puzzles views', 'Groups')
		expect(
			await screen.findByRole('button', {
				name: 'Edit group Design collection',
			}),
		).toBeInTheDocument()
		expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument()
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
		choose('Puzzles status', 'Unassigned')
		expect(
			await screen.findByRole('button', {
				name: 'Edit draft Unassigned design',
			}),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'New puzzle' }))
		expect(
			screen.getByRole('heading', { name: 'New puzzle' }),
		).toBeInTheDocument()
		choose('Puzzles status', 'Unassigned')
		expect(
			await screen.findByRole('button', {
				name: 'Edit draft Unassigned design',
			}),
		).toBeInTheDocument()
	})
	it('reuses cached catalogs across navigation and refetches only on request', async () => {
		render(<AdminWorkspace client={client} />)
		await screen.findByRole('button', {
			name: 'Edit group Design collection',
		})
		choose('Puzzles views', 'Puzzles')
		await screen.findByRole('button', {
			name: 'Edit draft Unassigned design',
		})
		choose('Puzzles status', 'Assigned')
		choose('Puzzles status', 'Unassigned')
		choose('Puzzles views', 'Groups')
		expect(
			screen.getByRole('button', {
				name: 'Edit group Design collection',
			}),
		).toBeInTheDocument()
		choose('Admin sections', 'Palettes')
		await screen.findByRole('button', {
			name: 'Edit group Color collection',
		})
		choose('Palettes views', 'Palettes')
		expect(
			screen.getByRole('button', { name: 'Edit Unassigned colors' }),
		).toBeInTheDocument()
		choose('Admin sections', 'Puzzles')
		expect(
			screen.getByRole('button', {
				name: 'Edit group Design collection',
			}),
		).toBeInTheDocument()
		expect(mocks.puzzleGroups).toHaveBeenCalledOnce()
		expect(mocks.puzzles).toHaveBeenCalledOnce()
		expect(mocks.palettes).toHaveBeenCalledOnce()
		expect(mocks.paletteGroups).toHaveBeenCalledOnce()
		fireEvent.click(screen.getByRole('button', { name: 'Refresh groups' }))
		await screen.findByRole('button', {
			name: 'Edit group Design collection',
		})
		expect(mocks.puzzleGroups).toHaveBeenCalledTimes(2)
		expect(mocks.puzzles).toHaveBeenCalledOnce()
	})
})
