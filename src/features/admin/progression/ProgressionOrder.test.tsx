import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import ProgressionOrder from './ProgressionOrder'
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
	manageShapeProgression: (...args: unknown[]) => mocks.manage(...args),
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

const shapeOrder = () =>
	screen
		.getAllByRole('listitem')
		.map(item => item.querySelector('strong')?.textContent)

function isProtected() {
	const event = new Event('beforeunload', { cancelable: true })
	window.dispatchEvent(event)
	return event.defaultPrevented
}

beforeEach(() => {
	vi.resetAllMocks()
	mocks.progression.mockResolvedValue(progression())
	mocks.manage.mockResolvedValue(undefined)
	mocks.palettes.mockResolvedValue(palettes)
	mocks.paletteGroups.mockResolvedValue(paletteGroups)
})

describe('progression shape order', () => {
	it('lists the shapes in unlock order and nothing else', async () => {
		render(<ProgressionOrder client={client} />)
		await screen.findByText('Hexagon')
		expect(screen.getByText('Open from the start')).toBeInTheDocument()
		expect(
			screen.getByText('Unlocks when a Hexagon core group is completed'),
		).toBeInTheDocument()
		expect(screen.queryByText(/core:/)).not.toBeInTheDocument()
		expect(shapeOrder()).toEqual(['Hexagon', 'Triangle'])
		for (const item of screen.getAllByRole('listitem')) {
			expect(item.querySelector('svg')).toBeInTheDocument()
		}
		expect(
			screen.getByRole('button', { name: 'Save order' }),
		).toBeDisabled()
		expect(
			screen.queryByRole('button', { name: /^Remove / }),
		).not.toBeInTheDocument()
	})

	it('stages a reorder until Save, then confirms it and updates the unlock text', async () => {
		render(<ProgressionOrder client={client} />)
		await screen.findByText('Hexagon')
		fireEvent.keyDown(
			screen.getByRole('button', { name: 'Reorder Hexagon' }),
			{
				key: 'ArrowDown',
			},
		)
		expect(shapeOrder()).toEqual(['Triangle', 'Hexagon'])
		expect(mocks.manage).not.toHaveBeenCalled()
		expect(isProtected()).toBe(true)
		fireEvent.click(screen.getByRole('button', { name: 'Save order' }))
		await screen.findByText('Shape order saved.')
		expect(mocks.manage).toHaveBeenCalledExactlyOnceWith(client, [
			'triangle',
			'hexagon',
		])
		expect(
			screen.getByText('Unlocks when a Triangle core group is completed'),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Save order' }),
		).toBeDisabled()
		await waitFor(() => expect(isProtected()).toBe(false))
		expect(mocks.progression).toHaveBeenCalledOnce()
	})

	it('keeps the staged order and shows the error when the save fails', async () => {
		mocks.manage.mockRejectedValueOnce(new Error('Lost connection'))
		render(<ProgressionOrder client={client} />)
		await screen.findByText('Hexagon')
		fireEvent.keyDown(
			screen.getByRole('button', { name: 'Reorder Hexagon' }),
			{
				key: 'ArrowDown',
			},
		)
		fireEvent.click(screen.getByRole('button', { name: 'Save order' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Lost connection',
		)
		expect(shapeOrder()).toEqual(['Triangle', 'Hexagon'])
		expect(screen.getByRole('button', { name: 'Save order' })).toBeEnabled()
		fireEvent.click(screen.getByRole('button', { name: 'Save order' }))
		await screen.findByText('Shape order saved.')
		expect(mocks.manage).toHaveBeenCalledTimes(2)
	})

	it('blocks duplicate saves while one is in flight', async () => {
		let finish!: () => void
		mocks.manage.mockReturnValueOnce(
			new Promise<void>(resolve => {
				finish = resolve
			}),
		)
		render(<ProgressionOrder client={client} />)
		await screen.findByText('Hexagon')
		fireEvent.keyDown(
			screen.getByRole('button', { name: 'Reorder Hexagon' }),
			{
				key: 'ArrowDown',
			},
		)
		const save = screen.getByRole('button', { name: 'Save order' })
		fireEvent.click(save)
		fireEvent.click(save)
		expect(mocks.manage).toHaveBeenCalledOnce()
		expect(screen.getByText('Saving shape order…')).toBeInTheDocument()
		finish()
		await screen.findByText('Shape order saved.')
	})

	it('is read-only once a core group is published', async () => {
		mocks.progression.mockResolvedValue(progression({ locked: true }))
		render(<ProgressionOrder client={client} />)
		await screen.findByText('Hexagon')
		expect(screen.getByRole('note')).toHaveTextContent('locked')
		expect(
			screen.getByRole('button', { name: 'Save order' }),
		).toBeDisabled()
		fireEvent.keyDown(
			screen.getByRole('button', { name: 'Reorder Hexagon' }),
			{
				key: 'ArrowDown',
			},
		)
		expect(shapeOrder()).toEqual(['Hexagon', 'Triangle'])
	})

	it('shows load failures and refreshes on request', async () => {
		mocks.progression.mockRejectedValueOnce(new Error('Offline'))
		render(<ProgressionOrder client={client} />)
		expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
		fireEvent.click(
			screen.getByRole('button', { name: 'Refresh shape order' }),
		)
		await screen.findByText('Hexagon')
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
	})
})
