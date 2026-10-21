import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import ProgressionRewards from './ProgressionRewards'
import { paletteGroups, palettes, progression } from './testFixtures'

const mocks = vi.hoisted(() => ({
	progression: vi.fn(),
	manage: vi.fn(),
	palettes: vi.fn(),
	paletteGroups: vi.fn(),
}))
vi.mock('@/features/admin/services/progression', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/progression')
	>()),
	loadProgression: (...args: unknown[]) => mocks.progression(...args),
	manageGroupReward: (...args: unknown[]) => mocks.manage(...args),
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

function isProtected() {
	const event = new Event('beforeunload', { cancelable: true })
	window.dispatchEvent(event)
	return event.defaultPrevented
}
async function open(name: string) {
	fireEvent.click(
		await screen.findByRole('button', { name: `Edit reward for ${name}` }),
	)
	return screen.findByRole('dialog', { name: `Reward for ${name}` })
}

beforeEach(() => {
	vi.resetAllMocks()
	mocks.progression.mockResolvedValue(progression())
	mocks.manage.mockResolvedValue(undefined)
	mocks.palettes.mockResolvedValue(palettes)
	mocks.paletteGroups.mockResolvedValue(paletteGroups)
})

describe('progression rewards', () => {
	it('shows each shape with its core and bonus groups, their rewards, and pattern warnings', async () => {
		render(<ProgressionRewards client={client} />)
		const hexagon = await screen.findByRole('region', { name: 'Hexagon' })
		const basic = within(hexagon).getByRole('listitem', {
			name: 'Reward for Neon Nights',
		})
		expect(basic).toHaveTextContent('Cabo')
		expect(
			within(hexagon).getByRole('listitem', {
				name: 'Reward for Neon Spin',
			}),
		).toHaveTextContent('Awards nothing yet')
		expect(within(hexagon).getByText('Bonus groups')).toBeInTheDocument()
		expect(
			within(hexagon).getByRole('listitem', {
				name: 'Reward for Neon Bonus',
			}),
		).toBeInTheDocument()
		expect(
			within(hexagon).getByRole('list', {
				name: 'Hexagon pattern warnings',
			}),
		).toHaveTextContent(
			'Rotation core group "Neon Spin" awards nothing yet.',
		)
		const triangle = screen.getByRole('region', { name: 'Triangle' })
		expect(
			within(triangle).getByText('No rotation core group yet.'),
		).toBeInTheDocument()
		expect(
			within(triangle).queryByText('Bonus groups'),
		).not.toBeInTheDocument()
	})

	it('offers only reward palette groups, with search, and saves one palette', async () => {
		render(<ProgressionRewards client={client} />)
		const dialog = await open('Neon Nights')
		expect(within(dialog).getByText('Earned palettes')).toBeInTheDocument()
		expect(
			within(dialog).queryByText('Sold palettes'),
		).not.toBeInTheDocument()
		expect(
			within(dialog).getByRole('button', {
				name: 'Award the Cabo palette',
			}),
		).toHaveAttribute('aria-pressed', 'true')
		expect(
			within(dialog).queryByRole('button', {
				name: 'Award the Regatta palette',
			}),
		).not.toBeInTheDocument()
		expect(
			within(dialog).queryByLabelText('Basic bonus group'),
		).not.toBeInTheDocument()
		fireEvent.change(
			within(dialog).getByLabelText('Search reward palettes'),
			{
				target: { value: 'tah' },
			},
		)
		expect(
			within(dialog).queryByRole('button', {
				name: 'Award the Cabo palette',
			}),
		).not.toBeInTheDocument()
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: 'Award the Tahiti palette',
			}),
		)
		expect(isProtected()).toBe(true)
		fireEvent.click(
			within(dialog).getByRole('button', { name: 'Save reward' }),
		)
		await screen.findByText('Saved the reward for "Neon Nights".')
		expect(mocks.manage).toHaveBeenCalledExactlyOnceWith(
			client,
			'hex-basic',
			{
				paletteIds: ['tahiti'],
				bonusGroupIds: [],
			},
		)
		await waitFor(() =>
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
		)
		expect(
			screen.getByRole('listitem', { name: 'Reward for Neon Nights' }),
		).toHaveTextContent('Tahiti')
		expect(mocks.progression).toHaveBeenCalledOnce()
		expect(isProtected()).toBe(false)
	})

	it('lets the rotation core group pick one basic and one rotation bonus group of its shape', async () => {
		render(<ProgressionRewards client={client} />)
		const dialog = await open('Neon Spin')
		const basic = within(dialog).getByLabelText('Basic bonus group')
		const rotation = within(dialog).getByLabelText('Rotation bonus group')
		const optionNames = (select: HTMLElement) =>
			within(select)
				.getAllByRole('option')
				.map(option => option.textContent)
		expect(optionNames(basic)).toEqual(['None', 'Neon Bonus'])
		expect(optionNames(rotation)).toEqual(['None', 'Neon Bonus Spin'])
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: 'Award the Tahiti palette',
			}),
		)
		fireEvent.change(basic, { target: { value: 'hex-bonus-basic' } })
		fireEvent.change(rotation, { target: { value: 'hex-bonus-rotation' } })
		fireEvent.click(
			within(dialog).getByRole('button', { name: 'Save reward' }),
		)
		await screen.findByText('Saved the reward for "Neon Spin".')
		expect(mocks.manage).toHaveBeenCalledExactlyOnceWith(
			client,
			'hex-rotation',
			{
				paletteIds: ['tahiti'],
				bonusGroupIds: ['hex-bonus-basic', 'hex-bonus-rotation'],
			},
		)
		expect(
			screen.getByRole('listitem', { name: 'Reward for Neon Spin' }),
		).toHaveTextContent('Bonus groups: Neon Bonus, Neon Bonus Spin')
	})

	it('shows the current bonus groups and can clear a reward', async () => {
		mocks.progression.mockResolvedValue(
			progression({
				rewards: [
					{
						groupId: 'hex-rotation',
						paletteIds: ['cabo'],
						bonusGroupIds: [
							'hex-bonus-basic',
							'hex-bonus-rotation',
						],
					},
				],
			}),
		)
		render(<ProgressionRewards client={client} />)
		const dialog = await open('Neon Spin')
		expect(within(dialog).getByLabelText('Basic bonus group')).toHaveValue(
			'hex-bonus-basic',
		)
		expect(
			within(dialog).getByLabelText('Rotation bonus group'),
		).toHaveValue('hex-bonus-rotation')
		fireEvent.click(
			within(dialog).getByRole('button', { name: 'Clear palette' }),
		)
		fireEvent.change(within(dialog).getByLabelText('Basic bonus group'), {
			target: { value: '' },
		})
		fireEvent.change(
			within(dialog).getByLabelText('Rotation bonus group'),
			{
				target: { value: '' },
			},
		)
		fireEvent.click(
			within(dialog).getByRole('button', { name: 'Save reward' }),
		)
		await screen.findByText('Saved the reward for "Neon Spin".')
		expect(mocks.manage).toHaveBeenCalledWith(client, 'hex-rotation', {
			paletteIds: [],
			bonusGroupIds: [],
		})
		expect(
			screen.getByRole('listitem', { name: 'Reward for Neon Spin' }),
		).toHaveTextContent('Awards nothing yet')
	})

	it('keeps the dialog open with the error when the save fails, and guards discarding', async () => {
		mocks.manage.mockRejectedValueOnce(
			new Error('Palette is not in a reward palette group'),
		)
		render(<ProgressionRewards client={client} />)
		const dialog = await open('Neon Nights')
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: 'Award the Tahiti palette',
			}),
		)
		fireEvent.click(
			within(dialog).getByRole('button', { name: 'Save reward' }),
		)
		expect(await within(dialog).findByRole('alert')).toHaveTextContent(
			'not in a reward palette group',
		)
		expect(
			within(dialog).getByRole('button', {
				name: 'Award the Tahiti palette',
			}),
		).toHaveAttribute('aria-pressed', 'true')
		fireEvent.click(
			within(dialog).getByRole('button', { name: 'Save reward' }),
		)
		await screen.findByText('Saved the reward for "Neon Nights".')
		expect(mocks.manage).toHaveBeenCalledTimes(2)
	})

	it('disables editing for published groups', async () => {
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
		render(<ProgressionRewards client={client} />)
		expect(
			await screen.findByRole('button', {
				name: 'Edit reward for Neon Nights',
			}),
		).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Edit reward for Neon Spin' }),
		).toBeEnabled()
	})

	it('explains when no reward palette group exists', async () => {
		mocks.paletteGroups.mockResolvedValue(
			paletteGroups.filter(group => group.purpose !== 'reward'),
		)
		render(<ProgressionRewards client={client} />)
		const dialog = await open('Neon Nights')
		expect(
			within(dialog).getByText(/No reward palette groups yet/),
		).toBeInTheDocument()
		expect(
			within(dialog).getByText(/no longer in a reward palette group/),
		).toBeInTheDocument()
	})

	it('reports load failures', async () => {
		mocks.progression.mockRejectedValueOnce(new Error('Offline'))
		render(<ProgressionRewards client={client} />)
		expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
	})
})
