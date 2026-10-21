import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import ProgressionSlots from './ProgressionSlots'
import { draft, paletteGroups, palettes, progression } from './testFixtures'

const mocks = vi.hoisted(() => ({
	progression: vi.fn(),
	manage: vi.fn(),
	palettes: vi.fn(),
	paletteGroups: vi.fn(),
	puzzles: vi.fn(),
	groups: vi.fn(),
}))
vi.mock('@/features/admin/services/progression', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/progression')
	>()),
	loadProgression: (...args: unknown[]) => mocks.progression(...args),
	manageProgressionSlot: (...args: unknown[]) => mocks.manage(...args),
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

vi.mock('@/features/admin/services/puzzleGroups', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/puzzleGroups')
	>()),
	loadPuzzleGroups: (...args: unknown[]) => mocks.groups(...args),
}))
vi.mock('@/features/admin/services/puzzleLibrary', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/puzzleLibrary')
	>()),
	loadPuzzleDrafts: (...args: unknown[]) => mocks.puzzles(...args),
}))

const client = {} as SupabaseClient<Database>
const hexBasic = { shapeId: 'hexagon', purpose: 'core', track: 'basic' }

function isProtected() {
	const event = new Event('beforeunload', { cancelable: true })
	window.dispatchEvent(event)
	return event.defaultPrevented
}
async function open(shape: string, title: string) {
	fireEvent.click(
		await screen.findByRole('button', { name: `Edit ${shape} ${title}` }),
	)
	return screen.findByRole('dialog')
}
const optionTexts = (select: HTMLElement) =>
	within(select)
		.getAllByRole('option')
		.map(option => option.textContent)

beforeEach(() => {
	vi.resetAllMocks()
	mocks.progression.mockResolvedValue(progression())
	mocks.manage.mockResolvedValue(undefined)
	mocks.palettes.mockResolvedValue(palettes)
	mocks.paletteGroups.mockResolvedValue(paletteGroups)
	mocks.puzzles.mockResolvedValue([])
	mocks.groups.mockResolvedValue([])
})

describe('puzzles and rewards', () => {
	it('lays each shape out as a box with a core box and a bonus box of four slots', async () => {
		render(<ProgressionSlots client={client} />)
		const hexagon = await screen.findByRole('region', { name: 'Hexagon' })
		const core = within(hexagon).getByRole('group', {
			name: 'Hexagon core groups',
		})
		const bonus = within(hexagon).getByRole('group', {
			name: 'Hexagon bonus groups',
		})
		expect(
			within(core)
				.getAllByRole('heading', { level: 4 })
				.map(heading => heading.textContent),
		).toEqual(['Basic', 'Rotation'])
		expect(
			within(bonus)
				.getAllByRole('heading', { level: 4 })
				.map(heading => heading.textContent),
		).toEqual(['Bonus Basic', 'Bonus Rotation'])
		const basic = within(core).getByRole('group', { name: 'Hexagon Basic' })
		expect(basic).toHaveTextContent('Neon Nights')
		expect(basic).toHaveTextContent('Reward')
		expect(basic).toHaveTextContent('Cabo')
		expect(
			within(core).getByRole('group', { name: 'Hexagon Rotation' }),
		).toHaveTextContent('No palette yet')
		expect(
			within(bonus).getByRole('group', { name: 'Hexagon Bonus Basic' }),
		).toHaveTextContent('Neon Bonus')
		const triangle = screen.getByRole('region', { name: 'Triangle' })
		expect(
			within(triangle).getByRole('group', { name: 'Triangle Rotation' }),
		).toHaveTextContent('Not assigned')
		expect(
			within(triangle).getByRole('group', {
				name: 'Triangle Bonus Basic',
			}),
		).toHaveTextContent('Not assigned')
	})

	it('has no bulleted lists apart from the warnings, and shows pattern warnings per shape', async () => {
		render(<ProgressionSlots client={client} />)
		const hexagon = await screen.findByRole('region', { name: 'Hexagon' })
		expect(
			within(hexagon).getByRole('list', {
				name: 'Hexagon pattern warnings',
			}),
		).toHaveTextContent(
			'Rotation core group "Neon Spin" awards nothing yet.',
		)
		expect(screen.getAllByRole('list')).toHaveLength(2)
		expect(
			within(screen.getByRole('region', { name: 'Triangle' })).getByRole(
				'list',
				{
					name: 'Triangle pattern warnings',
				},
			),
		).toHaveTextContent('Triangle has no rotation core group.')
	})

	it('shows warnings that belong to no shape above the shapes', async () => {
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
		render(<ProgressionSlots client={client} />)
		expect(
			await screen.findByRole('list', {
				name: 'General pattern warnings',
			}),
		).toHaveTextContent(/Palette "Cabo" is awarded by more than one group/)
	})

	it('lists grouped puzzles whose palette players cannot get', async () => {
		mocks.puzzles.mockResolvedValue([
			draft('a', 'Zeta puzzle', 'orphan', 'Neon Nights'),
			draft('b', 'Alpha puzzle', 'orphan', 'Neon Nights'),
			draft('c', 'Fine puzzle', 'cabo', 'Neon Nights'),
			draft('d', 'Loose puzzle', 'regatta', null),
			draft('e', 'Sold puzzle', 'regatta', 'Pack'),
		])
		render(<ProgressionSlots client={client} />)
		const item = await screen.findByText('Orphan')
		expect(item.closest('li')).toHaveTextContent(
			'Orphan: Alpha puzzle, Zeta puzzle',
		)
		expect(screen.queryByText('Regatta')).not.toBeInTheDocument()
	})

	it('says nothing about unavailable palettes when every one can be had', async () => {
		mocks.puzzles.mockResolvedValue([
			draft('c', 'Fine puzzle', 'cabo', 'Neon Nights'),
		])
		render(<ProgressionSlots client={client} />)
		await screen.findByRole('region', { name: 'Hexagon' })
		expect(
			screen.queryByText('Palettes players cannot get'),
		).not.toBeInTheDocument()
	})

	it('reports puzzle load failures', async () => {
		mocks.puzzles.mockRejectedValueOnce(new Error('Offline'))
		render(<ProgressionSlots client={client} />)
		expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
	})

	it('shows the first puzzle of each assigned group as a thumbnail without gridlines', async () => {
		mocks.groups.mockResolvedValue([
			{
				row: { id: 'hex-basic' },
				purpose: 'core',
				track: 'basic',
				members: [],
				preview: {
					version: 1,
					shape: 'hexagon',
					seed: 'x',
					gridSize: 2,
					paletteName: 'Cabo',
					target: { '0,0': '#ff0000' },
					pieces: [],
					solution: {},
				},
			},
		])
		render(<ProgressionSlots client={client} />)
		const basic = await screen.findByRole('group', {
			name: 'Hexagon Basic',
		})
		await waitFor(() =>
			expect(basic.querySelector('svg polygon')).toBeInTheDocument(),
		)
		const polygon = basic.querySelector('svg polygon') as SVGElement
		// Gridlines are replaced by a stroke in the cell's own color.
		expect(polygon.style.stroke).not.toBe('')
		expect(
			within(
				screen.getByRole('group', { name: 'Triangle Rotation' }),
			).queryByRole('img'),
		).not.toBeInTheDocument()
	})

	it('names the view Puzzles and rewards', async () => {
		render(<ProgressionSlots client={client} />)
		expect(
			await screen.findByRole('heading', { name: 'Puzzles and rewards' }),
		).toBeInTheDocument()
	})

	it('edits a slot: current group first, only groups that fit, reward palettes only, no search', async () => {
		render(<ProgressionSlots client={client} />)
		const dialog = await open('Hexagon', 'Basic')
		expect(
			within(dialog).getByRole('heading', {
				name: 'Hexagon: Basic core group',
			}),
		).toBeInTheDocument()
		const group = within(dialog).getByLabelText('Puzzle group')
		expect(group).toHaveValue('hex-basic')
		expect(optionTexts(group)).toEqual([
			'Not assigned',
			'Neon Nights',
			'Spare basic (Undecided, 3 puzzles)',
			'Spare empty (Undecided, 0 puzzles)',
		])
		expect(
			within(dialog).queryByLabelText(/Search/),
		).not.toBeInTheDocument()
		expect(within(dialog).getByText('Earned palettes')).toBeInTheDocument()
		expect(
			within(dialog).queryByText('Sold palettes'),
		).not.toBeInTheDocument()
		expect(
			within(dialog).getByRole('button', {
				name: 'Award the Cabo palette',
			}),
		).toHaveAttribute('aria-pressed', 'true')
	})

	it('saves a different palette for the slot and reloads the progression', async () => {
		render(<ProgressionSlots client={client} />)
		const dialog = await open('Hexagon', 'Basic')
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: 'Award the Dune palette',
			}),
		)
		expect(isProtected()).toBe(true)
		fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
		await screen.findByText(
			'Saved the basic core group for Hexagon: "Neon Nights".',
		)
		expect(mocks.manage).toHaveBeenCalledExactlyOnceWith(
			client,
			hexBasic,
			'hex-basic',
			['dune'],
		)
		await waitFor(() =>
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
		)
		await waitFor(() => expect(mocks.progression).toHaveBeenCalledTimes(2))
		await waitFor(() => expect(isProtected()).toBe(false))
	})

	it('greys out the colors of palettes another group already awards, keeps their names, and cannot pick them', async () => {
		mocks.progression.mockResolvedValue(
			progression({
				rewards: [
					{
						groupId: 'hex-basic',
						paletteIds: ['cabo'],
						bonusGroupIds: [],
					},
					{
						groupId: 'hex-rotation',
						paletteIds: ['tahiti'],
						bonusGroupIds: [],
					},
				],
			}),
		)
		render(<ProgressionSlots client={client} />)
		const dialog = await open('Hexagon', 'Basic')
		const taken = within(dialog).getByRole('button', {
			name: 'Already awarded by Neon Spin',
		})
		expect(taken).toBeDisabled()
		expect(taken).toHaveTextContent('Tahiti')
		expect(taken).toHaveAttribute('title', 'Tahiti')
		for (const swatch of Array.from(
			taken.querySelectorAll<HTMLElement>('span span'),
		)) {
			const { backgroundColor } = swatch.style
			const [r, g, b] = backgroundColor.match(/\d+/g) ?? []
			expect(r).toBe(g)
			expect(g).toBe(b)
		}
		// The slot's own palette and unclaimed palettes stay in color and selectable.
		const own = within(dialog).getByRole('button', {
			name: 'Award the Cabo palette',
		})
		expect(own).toBeEnabled()
		expect(own).toHaveTextContent('Cabo')
		expect(
			within(dialog).getByRole('button', {
				name: 'Award the Dune palette',
			}),
		).toBeEnabled()
		fireEvent.click(taken)
		expect(own).toHaveAttribute('aria-pressed', 'true')
	})

	it('shows the current reward palette with a reset that clears it, and saves nothing awarded', async () => {
		render(<ProgressionSlots client={client} />)
		const dialog = await open('Hexagon', 'Basic')
		expect(
			within(dialog).getByText('Current reward palette:'),
		).toHaveTextContent('Cabo')
		expect(
			within(dialog.querySelector('form') as HTMLElement).queryByRole(
				'group',
				{ name: /Reward palette/ },
			),
		).not.toBeInTheDocument()
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: 'Clear reward palette',
			}),
		)
		expect(within(dialog).getByText('No selection')).toBeInTheDocument()
		expect(
			within(dialog).queryByRole('button', {
				name: 'Clear reward palette',
			}),
		).not.toBeInTheDocument()
		fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
		await screen.findByText(
			'Saved the basic core group for Hexagon: "Neon Nights".',
		)
		expect(mocks.manage).toHaveBeenCalledExactlyOnceWith(
			client,
			hexBasic,
			'hex-basic',
			[],
		)
	})

	it('replaces the group in a slot, explains what happens to the old one, and starts without a palette', async () => {
		render(<ProgressionSlots client={client} />)
		const dialog = await open('Hexagon', 'Basic')
		fireEvent.change(within(dialog).getByLabelText('Puzzle group'), {
			target: { value: 'spare-basic' },
		})
		expect(
			within(dialog).getByText(
				'"Spare basic" will become the Hexagon basic core group.',
			),
		).toBeInTheDocument()
		expect(
			within(dialog).getByText(
				'"Neon Nights" will become Undecided and lose its reward.',
			),
		).toBeInTheDocument()
		expect(within(dialog).getByText('No selection')).toBeInTheDocument()
		expect(
			within(dialog).queryByRole('button', {
				name: 'Clear reward palette',
			}),
		).not.toBeInTheDocument()
		// The old group's palette is free for the new one.
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: 'Award the Cabo palette',
			}),
		)
		fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
		await screen.findByText(
			'Saved the basic core group for Hexagon: "Spare basic".',
		)
		expect(mocks.manage).toHaveBeenCalledExactlyOnceWith(
			client,
			hexBasic,
			'spare-basic',
			['cabo'],
		)
	})

	it('empties a slot', async () => {
		render(<ProgressionSlots client={client} />)
		const dialog = await open('Hexagon', 'Basic')
		fireEvent.change(within(dialog).getByLabelText('Puzzle group'), {
			target: { value: '' },
		})
		expect(
			within(dialog).queryByRole('button', { name: /^Award the/ }),
		).not.toBeInTheDocument()
		expect(
			within(dialog).getByText(
				'"Neon Nights" will become Undecided and lose its reward.',
			),
		).toBeInTheDocument()
		fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
		await screen.findByText('Emptied the basic core group for Hexagon.')
		expect(mocks.manage).toHaveBeenCalledExactlyOnceWith(
			client,
			hexBasic,
			null,
			[],
		)
	})

	it('fills an empty slot with a group that fits its shape and track', async () => {
		render(<ProgressionSlots client={client} />)
		const dialog = await open('Triangle', 'Bonus Rotation')
		const group = within(dialog).getByLabelText('Puzzle group')
		expect(group).toHaveValue('')
		expect(optionTexts(group)).toEqual([
			'Not assigned',
			'Spare empty (Undecided, 0 puzzles)',
		])
		expect(
			within(dialog).getByText(
				'Choose a puzzle group to pick its reward palette.',
			),
		).toBeInTheDocument()
		fireEvent.change(group, { target: { value: 'spare-empty' } })
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: 'Award the Dune palette',
			}),
		)
		fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
		await screen.findByText(
			'Saved the rotation bonus group for Triangle: "Spare empty".',
		)
		expect(mocks.manage).toHaveBeenCalledExactlyOnceWith(
			client,
			{ shapeId: 'triangle', purpose: 'reward', track: 'rotation' },
			'spare-empty',
			['dune'],
		)
	})

	it('says so when no group fits a slot', async () => {
		mocks.progression.mockResolvedValue(progression({ candidates: [] }))
		render(<ProgressionSlots client={client} />)
		const dialog = await open('Triangle', 'Rotation')
		expect(
			within(dialog).getByText(/No unassigned puzzle group fits here/),
		).toBeInTheDocument()
	})

	it('keeps the dialog open with the error when the save fails', async () => {
		mocks.manage.mockRejectedValueOnce(
			new Error('Group "X" already fills another slot.'),
		)
		render(<ProgressionSlots client={client} />)
		const dialog = await open('Hexagon', 'Basic')
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: 'Award the Dune palette',
			}),
		)
		fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
		expect(await within(dialog).findByRole('alert')).toHaveTextContent(
			'already fills another slot',
		)
		expect(
			within(dialog).getByRole('button', {
				name: 'Award the Dune palette',
			}),
		).toHaveAttribute('aria-pressed', 'true')
		fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
		await screen.findByText(/Saved the basic core group/)
		expect(mocks.manage).toHaveBeenCalledTimes(2)
	})

	it('disables editing for a published group', async () => {
		mocks.progression.mockResolvedValue(
			progression({
				groups: progression().groups.map(group =>
					group.id === 'hex-basic'
						? { ...group, published: true }
						: group,
				),
				locked: true,
			}),
		)
		render(<ProgressionSlots client={client} />)
		expect(
			await screen.findByRole('button', { name: 'Edit Hexagon Basic' }),
		).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Edit Hexagon Rotation' }),
		).toBeEnabled()
	})

	it('explains when no reward palette group exists', async () => {
		mocks.paletteGroups.mockResolvedValue(
			paletteGroups.filter(group => group.purpose !== 'reward'),
		)
		render(<ProgressionSlots client={client} />)
		const dialog = await open('Hexagon', 'Basic')
		expect(
			within(dialog).getByText(/No reward palette groups yet/),
		).toBeInTheDocument()
	})

	it('reports load failures', async () => {
		mocks.progression.mockRejectedValueOnce(new Error('Offline'))
		render(<ProgressionSlots client={client} />)
		expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
	})
})
