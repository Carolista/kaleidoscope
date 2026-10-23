import { fireEvent, screen } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
	generateAuthoredPuzzle,
	PUZZLE_RECIPES,
	type AuthoringPalette,
} from '@/domain/puzzles'
import {
	puzzleDraftArgs,
	type LibraryDraft,
	type PuzzleGroup,
} from '@/features/admin/services'
import type { Database } from '@/lib/supabase'
import PreparedPuzzleLibrary from './PreparedPuzzleLibrary'

const mocks = vi.hoisted(() => ({
	prepared: vi.fn(),
	groups: vi.fn(),
	preview: vi.fn(),
}))
vi.mock('@/features/admin/services/puzzleLibrary', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/puzzleLibrary')
	>()),
	loadPreparedPuzzles: (...args: unknown[]) => mocks.prepared(...args),
}))
vi.mock('@/features/admin/services/puzzleGroups', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/puzzleGroups')
	>()),
	loadPuzzleGroups: (...args: unknown[]) => mocks.groups(...args),
}))
vi.mock('@/features/admin/services/release', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/release')
	>()),
	previewRelease: (...args: unknown[]) => mocks.preview(...args),
}))

const client = {} as SupabaseClient<Database>
const palette: AuthoringPalette = {
	id: 'cabo',
	name: 'Cabo',
	colors: ['#112233', '#223344', '#334455', '#445566', '#556677'],
}
const puzzle = generateAuthoredPuzzle(
	'test',
	palette.id,
	PUZZLE_RECIPES[0],
	'hexagon',
)

function prepared(
	id: string,
	name: string,
	release: { published_at: string; release_at: string },
	group: { id: string; name: string; purpose: 'core' | 'daily' } | null,
	position = 1,
): LibraryDraft {
	const args = puzzleDraftArgs(id, name, puzzle)
	return {
		row: {
			id,
			name,
			shape_id: 'hexagon',
			palette_id: palette.id,
			board_size: args.p_board_size,
			rotation_allowed: args.p_rotation_allowed,
			difficulty: args.p_difficulty,
			definition: args.p_definition,
			...release,
		},
		assigned: group !== null,
		groupId: group?.id ?? null,
		groupName: group?.name ?? null,
		groupPosition: group ? position : null,
		groupPurpose: group?.purpose ?? null,
		groupTrack: group ? 'basic' : null,
		puzzle,
	}
}

const soon = {
	published_at: '2026-01-01T00:00:00Z',
	release_at: '2999-01-01T00:00:00Z',
}
const later = {
	published_at: '2026-01-01T00:00:00Z',
	release_at: '2999-06-01T00:00:00Z',
}
const past = {
	published_at: '2000-01-01T00:00:00Z',
	release_at: '2000-01-01T00:00:00Z',
}
const core = { id: 'core', name: 'Core basic', purpose: 'core' as const }
const daily = { id: 'daily', name: 'Daily month', purpose: 'daily' as const }

const groupRow = (
	id: string,
	name: string,
	release: { published_at: string | null; release_at: string | null },
): PuzzleGroup => ({
	row: {
		id,
		name,
		purpose: 'core',
		track: 'basic',
		shape_id: 'hexagon',
		selection_mode: 'any',
		...release,
	},
	purpose: 'core',
	track: 'basic',
	preview: null,
	members: [],
})

function renderLibrary(status: 'scheduled' | 'published') {
	return render(
		<PreparedPuzzleLibrary
			client={client}
			status={status}
			palettes={[palette]}
		/>,
	)
}

beforeEach(() => {
	vi.resetAllMocks()
	mocks.prepared.mockResolvedValue([
		prepared('a', 'Second scheduled', later, core, 2),
		prepared('b', 'First scheduled', soon, core, 1),
		prepared('c', 'Live puzzle', past, daily),
	])
	mocks.groups.mockResolvedValue([
		groupRow('core', 'Core basic', soon),
		groupRow('daily', 'Daily month', past),
	])
})

describe('scheduled puzzles', () => {
	it('lists only scheduled puzzles, earliest release first, with their release times', async () => {
		renderLibrary('scheduled')
		expect(
			await screen.findByRole('heading', { name: 'Scheduled puzzles' }),
		).toBeInTheDocument()
		const cards = await screen.findAllByRole('listitem')
		expect(cards.map(card => card.getAttribute('aria-label'))).toEqual([
			'Puzzle First scheduled',
			'Puzzle Second scheduled',
		])
		expect(screen.queryByText('Live puzzle')).not.toBeInTheDocument()
		expect(screen.getAllByText(/^Scheduled for /)).toHaveLength(2)
		expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
	})

	it('has no release buttons on puzzle cards', async () => {
		renderLibrary('scheduled')
		await screen.findByText('First scheduled')
		expect(
			screen.queryByRole('button', { name: /^(Re|Un)?[Ss]chedule / }),
		).not.toBeInTheDocument()
	})

	it('filters by purpose and group', async () => {
		mocks.prepared.mockResolvedValue([
			prepared('a', 'Core puzzle', soon, core),
			prepared('d', 'Daily puzzle', later, daily),
		])
		renderLibrary('scheduled')
		await screen.findByText('Core puzzle')
		fireEvent.change(screen.getByLabelText('Show purpose'), {
			target: { value: 'daily' },
		})
		expect(screen.queryByText('Core puzzle')).not.toBeInTheDocument()
		expect(screen.getByText('Daily puzzle')).toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Show purpose'), {
			target: { value: 'all' },
		})
		fireEvent.change(screen.getByLabelText('Show group'), {
			target: { value: 'core' },
		})
		expect(screen.getByText('Core puzzle')).toBeInTheDocument()
		expect(screen.queryByText('Daily puzzle')).not.toBeInTheDocument()
	})

	it('opens a scheduled puzzle in the editor', async () => {
		renderLibrary('scheduled')
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Edit puzzle First scheduled',
			}),
		)
		expect(
			await screen.findByRole('form', { name: 'Edit puzzle draft' }),
		).toBeInTheDocument()
		expect(screen.getByText(/^Scheduled for /)).toBeInTheDocument()
	})

	it('says when nothing is scheduled', async () => {
		mocks.prepared.mockResolvedValue([prepared('c', 'Live', past, daily)])
		renderLibrary('scheduled')
		expect(
			await screen.findByText(
				'No puzzles are scheduled. Groups are scheduled from the Release tab, or from Puzzles > Groups.',
			),
		).toBeInTheDocument()
	})
})

describe('published puzzles', () => {
	it('lists live puzzles without release buttons, and opens a read-only view', async () => {
		renderLibrary('published')
		expect(
			await screen.findByRole('heading', { name: 'Published puzzles' }),
		).toBeInTheDocument()
		expect(screen.getByText('Live puzzle')).toBeInTheDocument()
		expect(screen.queryByText('First scheduled')).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', {
				name: /chedule (group|Hexagon package)/,
			}),
		).not.toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('button', { name: 'View puzzle Live puzzle' }),
		)
		expect(
			await screen.findByRole('heading', {
				name: 'Live puzzle (read-only)',
			}),
		).toBeInTheDocument()
		expect(
			screen.getByText('Live puzzles can no longer be changed.'),
		).toBeInTheDocument()
		expect(screen.getByText('Cabo')).toBeInTheDocument()
		expect(
			screen.queryByRole('form', { name: 'Edit puzzle draft' }),
		).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Back to puzzles' }))
		expect(await screen.findByText('Live puzzle')).toBeInTheDocument()
	})

	it('says when nothing is live and reports a failed load', async () => {
		mocks.prepared.mockResolvedValue([])
		renderLibrary('published')
		expect(
			await screen.findByText('No puzzles are live yet.'),
		).toBeInTheDocument()
	})

	it('shows the error when puzzles cannot be loaded', async () => {
		mocks.prepared.mockRejectedValue(new Error('Offline'))
		renderLibrary('published')
		expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
	})
})
