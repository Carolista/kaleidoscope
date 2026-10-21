import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import ProgressionChecks from './ProgressionChecks'
import { draft, paletteGroups, palettes, progression } from './testFixtures'

const mocks = vi.hoisted(() => ({
	progression: vi.fn(),
	palettes: vi.fn(),
	paletteGroups: vi.fn(),
	puzzles: vi.fn(),
}))
vi.mock('@/features/admin/services/progression', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/progression')
	>()),
	loadProgression: (...args: unknown[]) => mocks.progression(...args),
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
vi.mock('@/features/admin/services/puzzleLibrary', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/puzzleLibrary')
	>()),
	loadPuzzleDrafts: (...args: unknown[]) => mocks.puzzles(...args),
}))

const client = {} as SupabaseClient<Database>

beforeEach(() => {
	vi.resetAllMocks()
	mocks.progression.mockResolvedValue(progression())
	mocks.palettes.mockResolvedValue(palettes)
	mocks.paletteGroups.mockResolvedValue(paletteGroups)
	mocks.puzzles.mockResolvedValue([])
})

describe('progression checks', () => {
	it('lists reward pattern warnings by shape, in shape order', async () => {
		render(<ProgressionChecks client={client} />)
		const hexagon = await screen.findByRole('region', {
			name: 'Hexagon warnings',
		})
		expect(
			within(hexagon).getByText(
				'Rotation core group "Neon Spin" awards nothing yet.',
			),
		).toBeInTheDocument()
		const triangle = screen.getByRole('region', {
			name: 'Triangle warnings',
		})
		expect(
			within(triangle).getByText('Triangle has no rotation core group.'),
		).toBeInTheDocument()
		expect(
			screen.getByText(
				'These checks only warn; they do not block publishing.',
			),
		).toBeInTheDocument()
	})

	it('shows general warnings and a clean pattern message', async () => {
		mocks.progression.mockResolvedValue(
			progression({
				shapeIds: ['hexagon'],
				rewards: [
					{
						groupId: 'hex-basic',
						paletteIds: ['cabo'],
						bonusGroupIds: [],
					},
					{
						groupId: 'hex-bonus-basic',
						paletteIds: ['cabo'],
						bonusGroupIds: [],
					},
				],
			}),
		)
		render(<ProgressionChecks client={client} />)
		const general = await screen.findByRole('region', {
			name: 'General warnings',
		})
		expect(
			within(general).getByText(
				/Palette "Cabo" is awarded by more than one group/,
			),
		).toBeInTheDocument()
		mocks.progression.mockResolvedValue(
			progression({
				shapeIds: ['hexagon'],
				groups: [
					{
						id: 'b',
						name: 'B',
						purpose: 'core',
						shapeId: 'hexagon',
						track: 'basic',
						published: false,
					},
					{
						id: 'r',
						name: 'R',
						purpose: 'core',
						shapeId: 'hexagon',
						track: 'rotation',
						published: false,
					},
					{
						id: 'x',
						name: 'X',
						purpose: 'reward',
						shapeId: 'hexagon',
						track: 'basic',
						published: false,
					},
					{
						id: 'y',
						name: 'Y',
						purpose: 'reward',
						shapeId: 'hexagon',
						track: 'rotation',
						published: false,
					},
				],
				rewards: [
					{ groupId: 'b', paletteIds: ['cabo'], bonusGroupIds: [] },
					{
						groupId: 'r',
						paletteIds: ['tahiti'],
						bonusGroupIds: ['x', 'y'],
					},
					{
						groupId: 'x',
						paletteIds: ['regatta'],
						bonusGroupIds: [],
					},
					{ groupId: 'y', paletteIds: ['orphan'], bonusGroupIds: [] },
				],
			}),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Refresh checks' }))
		await screen.findByText('Every shape follows the reward pattern.')
	})

	it('lists grouped puzzles whose palette players cannot get', async () => {
		mocks.puzzles.mockResolvedValue([
			draft('a', 'Zeta puzzle', 'orphan', 'Neon Nights'),
			draft('b', 'Alpha puzzle', 'orphan', 'Neon Nights'),
			draft('c', 'Fine puzzle', 'cabo', 'Neon Nights'),
			draft('d', 'Loose puzzle', 'regatta', null),
			draft('e', 'Sold puzzle', 'regatta', 'Pack'),
		])
		render(<ProgressionChecks client={client} />)
		const item = await screen.findByText('Orphan')
		expect(item.closest('li')).toHaveTextContent(
			'Orphan: Alpha puzzle, Zeta puzzle',
		)
		expect(screen.queryByText('Regatta')).not.toBeInTheDocument()
	})

	it('confirms when every palette is available', async () => {
		mocks.puzzles.mockResolvedValue([
			draft('c', 'Fine puzzle', 'cabo', 'Neon Nights'),
		])
		render(<ProgressionChecks client={client} />)
		await screen.findByText(
			/Every palette used by a puzzle in a group is in a core/,
		)
	})

	it('reports load failures', async () => {
		mocks.puzzles.mockRejectedValueOnce(new Error('Offline'))
		render(<ProgressionChecks client={client} />)
		expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
	})
})
