import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PuzzleGroup } from '@/features/admin/services'
import {
	paletteGroups,
	palettes,
	progression,
} from '@/features/admin/progression/testFixtures'
import type { Database } from '@/lib/supabase'
import ReleaseOverview from './ReleaseOverview'

const mocks = vi.hoisted(() => ({
	progression: vi.fn(),
	groups: vi.fn(),
	palettes: vi.fn(),
	paletteGroups: vi.fn(),
	preview: vi.fn(),
}))
vi.mock('@/features/admin/services/progression', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/progression')
	>()),
	loadProgression: (...args: unknown[]) => mocks.progression(...args),
}))
vi.mock('@/features/admin/services/puzzleGroups', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/puzzleGroups')
	>()),
	loadPuzzleGroups: (...args: unknown[]) => mocks.groups(...args),
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
vi.mock('@/features/admin/services/release', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/release')
	>()),
	previewRelease: (...args: unknown[]) => mocks.preview(...args),
}))

const client = {} as SupabaseClient<Database>
const open = { published_at: null, release_at: null }
const scheduled = {
	published_at: '2026-01-01T00:00:00Z',
	release_at: '2999-01-01T00:00:00Z',
}
const live = {
	published_at: '2000-01-01T00:00:00Z',
	release_at: '2000-01-01T00:00:00Z',
}

function puzzleGroup(
	id: string,
	name: string,
	puzzles: number,
	release: typeof open | typeof live = open,
	purpose: PuzzleGroup['purpose'] = 'core',
	track: PuzzleGroup['track'] = 'basic',
	shape: string | null = 'hexagon',
): PuzzleGroup {
	return {
		row: {
			id,
			name,
			purpose,
			track,
			shape_id: shape,
			selection_mode: 'any',
			...release,
		},
		purpose,
		track,
		preview: null,
		members: Array.from({ length: puzzles }, (_, index) => ({
			puzzleId: `${id}-${index}`,
			name: `Puzzle ${index}`,
			position: index + 1,
			preview: null,
		})),
	}
}

const row = (shape: string, title: string) =>
	within(screen.getByRole('table', { name: `${shape} release status` }))
		.getByRole('rowheader', { name: title })
		.closest('tr')!

beforeEach(() => {
	vi.resetAllMocks()
	mocks.progression.mockResolvedValue(progression())
	mocks.palettes.mockResolvedValue(palettes)
	mocks.paletteGroups.mockResolvedValue(paletteGroups)
	mocks.groups.mockResolvedValue([
		puzzleGroup('hex-basic', 'Neon Nights', 24),
		puzzleGroup(
			'hex-rotation',
			'Neon Spin',
			23,
			scheduled,
			'core',
			'rotation',
		),
		puzzleGroup('hex-bonus-basic', 'Neon Bonus', 24, live, 'reward'),
		puzzleGroup(
			'tri-basic',
			'Tri Bright',
			24,
			open,
			'core',
			'basic',
			'triangle',
		),
		puzzleGroup('daily-1', 'Daily October', 31, open, 'daily', null, null),
	])
})

describe('release overview', () => {
	it('shows each shape in unlock order with its four slots', async () => {
		render(<ReleaseOverview client={client} />)
		await screen.findByRole('table', { name: 'Hexagon release status' })
		expect(
			screen
				.getAllByRole('heading', { level: 3 })
				.map(heading => heading.textContent)
				.slice(0, 2),
		).toEqual(['Hexagon', 'Triangle'])
		const table = screen.getByRole('table', {
			name: 'Hexagon release status',
		})
		expect(
			within(table)
				.getAllByRole('rowheader')
				.map(header => header.textContent),
		).toEqual(['Basic', 'Rotation', 'Bonus Basic', 'Bonus Rotation'])
		expect(
			within(row('Triangle', 'Rotation')).getByText('Not assigned'),
		).toBeInTheDocument()
	})

	it('shows each slot group with its puzzles, reward, and state', async () => {
		render(<ReleaseOverview client={client} />)
		await screen.findByRole('table', { name: 'Hexagon release status' })
		const basic = row('Hexagon', 'Basic')
		expect(within(basic).getByText('Neon Nights')).toBeInTheDocument()
		expect(within(basic).getByText('24 puzzles')).toBeInTheDocument()
		expect(within(basic).getByText('Cabo')).toBeInTheDocument()
		expect(within(basic).getByText('Draft')).toBeInTheDocument()
		expect(
			within(row('Hexagon', 'Rotation')).getByText(/^Scheduled for /),
		).toBeInTheDocument()
		expect(
			within(row('Hexagon', 'Bonus Basic')).getByText('Live'),
		).toBeInTheDocument()
		expect(
			within(
				screen.getByRole('table', { name: 'Hexagon release status' }),
			).queryByRole('button'),
		).not.toBeInTheDocument()
	})

	it('lists what blocks each package, slot by slot', async () => {
		render(<ReleaseOverview client={client} />)
		const hexagon = await screen.findByRole('list', {
			name: 'Hexagon package problems',
		})
		expect(
			within(hexagon)
				.getAllByRole('listitem')
				.map(item => item.textContent),
		).toEqual(
			expect.arrayContaining([
				'Rotation: Has 23 puzzles; needs exactly 24.',
				'Rotation: Awards no palette.',
			]),
		)
		const triangle = screen.getByRole('list', {
			name: 'Triangle package problems',
		})
		expect(
			within(triangle).getByText('Rotation: needs a puzzle group.'),
		).toBeInTheDocument()
	})

	it('shows the package status for each shape', async () => {
		render(<ReleaseOverview client={client} />)
		await screen.findByRole('table', { name: 'Hexagon release status' })
		expect(
			screen.getByText('4 of 4 groups Partly scheduled'),
		).toBeInTheDocument()
		expect(screen.getByText('1 of 4 groups Draft')).toBeInTheDocument()
	})

	it('summarizes how many groups are draft, scheduled, and live', async () => {
		render(<ReleaseOverview client={client} />)
		const summary = await screen.findByRole('table', {
			name: 'Release summary',
		})
		expect(
			within(summary)
				.getAllByRole('columnheader')
				.map(header => header.textContent),
		).toEqual(['Content', 'Drafted', 'Scheduled', 'Live'])
		const cells = (name: RegExp) =>
			within(within(summary).getByRole('row', { name }))
				.getAllByRole('cell')
				.map(cell => cell.textContent)
		expect(cells(/Core & Bonus Groups/)).toEqual(['2', '1', '1'])
		expect(cells(/Other Puzzle Groups/)).toEqual(['1', '0', '0'])
		expect(cells(/Palette Groups/)).toEqual(['2', '0', '0'])
	})

	it('offers package buttons by state, one set per shape', async () => {
		render(<ReleaseOverview client={client} />)
		await screen.findByRole('table', { name: 'Hexagon release status' })
		// Hexagon is partly scheduled, so it can be rescheduled or unscheduled as a whole.
		expect(
			screen.getByRole('button', { name: 'Reschedule Hexagon package' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Unschedule Hexagon package' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Schedule Triangle package' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: /Neon/ }),
		).not.toBeInTheDocument()
	})

	it('opens the release dialog for a package', async () => {
		mocks.preview.mockResolvedValue({
			action: 'schedule',
			kind: 'shape_package',
			id: 'triangle',
			name: 'Triangle package',
			state: 'draft',
			releaseAt: null,
			items: [],
			blockers: [],
			warnings: [],
		})
		render(<ReleaseOverview client={client} />)
		await screen.findByRole('table', { name: 'Triangle release status' })
		fireEvent.click(
			screen.getByRole('button', { name: 'Schedule Triangle package' }),
		)
		expect(
			await screen.findByRole('heading', {
				name: 'Release "Triangle package"',
			}),
		).toBeInTheDocument()
	})

	it('lists palette groups with their problems', async () => {
		render(<ReleaseOverview client={client} />)
		const table = await screen.findByRole('table', {
			name: 'Palette group release status',
		})
		const rows = within(table).getAllByRole('row').slice(1)
		expect(
			rows.map(item => within(item).getByRole('rowheader').textContent),
		).toEqual(['Earned palettes', 'Sold palettes', 'Maybe palettes'])
		expect(
			within(rows[0]).getByText('Has 3 palettes; needs exactly 6.'),
		).toBeInTheDocument()
		expect(
			within(rows[1]).queryByText(/needs exactly/),
		).not.toBeInTheDocument()
		expect(
			within(rows[2]).getByText('Choose a purpose.'),
		).toBeInTheDocument()
		expect(
			within(rows[0]).queryByRole('button', {
				name: /palette group Earned palettes/,
			}),
		).not.toBeInTheDocument()
		expect(within(rows[0]).getByText('0 of 3 live')).toBeInTheDocument()
		expect(
			within(rows[1]).getByRole('button', {
				name: 'Schedule palette group Sold palettes',
			}),
		).toBeInTheDocument()
	})

	it('reports reward palettes by how many have gone out, never as a group release', async () => {
		mocks.palettes.mockResolvedValue(
			palettes.map(palette =>
				palette.id === 'cabo'
					? { ...palette, ...live }
					: palette.id === 'tahiti'
						? { ...palette, ...scheduled }
						: palette,
			),
		)
		render(<ReleaseOverview client={client} />)
		const table = await screen.findByRole('table', {
			name: 'Palette group release status',
		})
		expect(
			within(table).getByText('1 of 3 live 1 scheduled'),
		).toBeInTheDocument()
		const reward = within(
			screen.getByRole('table', { name: 'Release summary' }),
		).getByRole('row', { name: /Reward Palettes/ })
		const rewardCell = within(reward).getByRole('cell')
		expect(rewardCell).toHaveAttribute('colspan', '3')
		expect(rewardCell).toHaveTextContent(/1 of 3 live\s*1 scheduled/)
	})

	it('marks what is live, scheduled, partly released, or blocked', async () => {
		mocks.palettes.mockResolvedValue(
			palettes.map(palette =>
				palette.id === 'cabo'
					? { ...palette, ...live }
					: palette.id === 'tahiti'
						? { ...palette, ...scheduled }
						: palette,
			),
		)
		render(<ReleaseOverview client={client} />)
		const groups = await screen.findByRole('table', {
			name: 'Palette group release status',
		})
		const [earned, sold, maybe] = within(groups)
			.getAllByRole('row')
			.slice(1)
		expect(
			within(earned).getByRole('img', { name: 'Partly released' }),
		).toBeInTheDocument()
		expect(within(sold).queryByRole('img')).not.toBeInTheDocument()
		expect(
			within(maybe).getByRole('img', { name: 'Choose a purpose.' }),
		).toBeInTheDocument()
		expect(
			screen.getAllByRole('img', { name: 'Scheduled' }).length,
		).toBeGreaterThan(0)
		expect(
			screen.getByRole('img', {
				name: /problems? to fix before releasing/,
			}),
		).toBeInTheDocument()
	})

	it('marks a reward palette group green once every palette is live', async () => {
		mocks.palettes.mockResolvedValue(
			palettes.map(palette => ({ ...palette, ...live })),
		)
		render(<ReleaseOverview client={client} />)
		const groups = await screen.findByRole('table', {
			name: 'Palette group release status',
		})
		const [earned, sold] = within(groups).getAllByRole('row').slice(1)
		expect(
			within(earned).getByRole('img', { name: 'All palettes live' }),
		).toBeInTheDocument()
		expect(within(earned).getByText('3 of 3 live')).toBeInTheDocument()
		expect(
			within(sold).getByRole('button', {
				name: 'Schedule palette group Sold palettes',
			}),
		).toBeInTheDocument()
	})

	it('lists puzzle groups that are not in a slot', async () => {
		render(<ReleaseOverview client={client} />)
		const table = await screen.findByRole('table', {
			name: 'Other puzzle group release status',
		})
		const daily = within(table).getByRole('rowheader', {
			name: 'Daily October',
		})
		expect(within(daily.closest('tr')!).getByText('31')).toBeInTheDocument()
		expect(
			within(daily.closest('tr')!).getByText('All shapes'),
		).toBeInTheDocument()
		expect(within(table).queryByText('Neon Nights')).not.toBeInTheDocument()
	})

	it('shows load errors', async () => {
		mocks.groups.mockRejectedValue(new Error('Offline'))
		render(<ReleaseOverview client={client} />)
		expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
	})
})
