import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@test/renderWithNavigationGuard'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '../../types/database'
import type { CatalogScheme } from '../../services/colorSchemes'
import type { SchemeUsage } from '../../services/schemeUsage'
import SchemeLibrary from './SchemeLibrary'
import type { SchemeSet } from '../../services/schemeSets'
import { useState } from 'react'

const mocks = vi.hoisted(() => ({
	load: vi.fn(),
	manage: vi.fn(),
	usage: vi.fn(),
	sets: vi.fn(),
	manageSet: vi.fn(),
}))
vi.mock('../../services/schemeSets', async importOriginal => ({
	...(await importOriginal<typeof import('../../services/schemeSets')>()),
	loadSchemeSets: (...args: unknown[]) => mocks.sets(...args),
	manageSchemeSet: (...args: unknown[]) => mocks.manageSet(...args),
}))
vi.mock('../../services/colorSchemes', async importOriginal => ({
	...(await importOriginal<typeof import('../../services/colorSchemes')>()),
	loadColorSchemes: (...args: unknown[]) => mocks.load(...args),
	manageColorScheme: (...args: unknown[]) => mocks.manage(...args),
}))
vi.mock('../../services/schemeUsage', async importOriginal => ({
	...(await importOriginal<typeof import('../../services/schemeUsage')>()),
	loadSchemeUsage: (...args: unknown[]) => mocks.usage(...args),
}))
const client = {} as SupabaseClient<Database>
const scheme: CatalogScheme = {
	id: 'cabo',
	name: 'Cabo',
	colors: ['#112233', '#223344', '#334455', '#445566', '#556677'],
	revision: 1,
	published_at: null,
	release_at: null,
}
const emptyUsage: SchemeUsage = {
	puzzles: [],
	rewards: [],
	packs: [],
	starters: 0,
	grants: 0,
	corrections: 0,
}
const paletteSet: SchemeSet = {
	row: {
		id: 'set-one',
		name: 'Warm colors',
		kind: 'undecided',
		published_at: null,
		release_at: null,
	},
	kind: 'undecided',
	members: [scheme],
}
beforeEach(() => {
	vi.resetAllMocks()
	mocks.load.mockResolvedValue([scheme])
	mocks.manage.mockResolvedValue(undefined)
	mocks.usage.mockResolvedValue(emptyUsage)
	mocks.sets.mockResolvedValue([])
	mocks.manageSet.mockResolvedValue(undefined)
})
afterEach(() => vi.restoreAllMocks())

async function openEditor() {
	fireEvent.click(await screen.findByRole('button', { name: 'Edit Cabo' }))
	await screen.findByText(/No saved references/)
}
async function openSets() {
	await screen.findByRole('button', { name: 'Edit Cabo' })
	fireEvent.click(screen.getByRole('button', { name: 'Sets' }))
}
function PaletteWorkspace() {
	const [view, setView] = useState<'sets' | 'palettes'>('palettes')
	return (
		<>
			<button onClick={() => setView('sets')}>Sets</button>
			<button onClick={() => setView('palettes')}>Palette catalog</button>
			<SchemeLibrary client={client} view={view} />
		</>
	)
}
function setup() {
	const isProtected = () => {
		const event = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(event)
		return event.defaultPrevented
	}
	return {
		...render(<PaletteWorkspace />),
		isProtected,
	}
}
function sandboxFills() {
	return [
		...screen
			.getByRole('img', { name: 'Palette sandbox design' })
			.querySelectorAll('polygon'),
	].map(cell => cell.getAttribute('fill'))
}

describe('palette management', () => {
	it('filters grouped palettes and atomically moves selected palettes into a draft set', async () => {
		mocks.sets.mockResolvedValue([
			paletteSet,
			{
				...paletteSet,
				row: { ...paletteSet.row, id: 'set-two', name: 'Pack colors' },
				members: [],
			},
		])
		setup()
		await screen.findByRole('button', { name: 'Edit Cabo' })
		expect(screen.getByText('Warm colors · Undecided')).toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Show palettes'), {
			target: { value: 'ungrouped' },
		})
		expect(
			screen.queryByRole('button', { name: 'Edit Cabo' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByText('No palettes match this view.'),
		).toBeInTheDocument()
		expect(screen.queryByRole('list')).not.toBeInTheDocument()
		expect(screen.queryByText(/No palettes yet/)).not.toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Show palettes'), {
			target: { value: 'set-one' },
		})
		expect(
			screen.queryByText('No palettes match this view.'),
		).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select Cabo' }))
		fireEvent.change(screen.getByLabelText('Assign selected to set'), {
			target: { value: 'set-two' },
		})
		fireEvent.click(
			screen.getByRole('button', { name: 'Assign 1 selected' }),
		)
		const assignment = screen.getByRole('dialog', {
			name: 'Assign selected palettes to set',
		})
		expect(assignment).toHaveTextContent('Pack colors')
		expect(assignment).toHaveTextContent('Cabo')
		expect(mocks.manageSet).not.toHaveBeenCalled()
		fireEvent.click(
			within(assignment).getByRole('button', { name: 'Assign palettes' }),
		)
		await screen.findByText(/Palettes assigned/)
		expect(mocks.manageSet).toHaveBeenCalledExactlyOnceWith(
			client,
			'set-two',
			{ kind: 'assign', paletteIds: ['cabo'] },
		)
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Assign 0 selected' }),
			).toBeDisabled(),
		)
	})

	it('retains the palette filter, selection, and assignment target on cancellation or write failure', async () => {
		mocks.sets.mockResolvedValue([paletteSet])
		let fail!: (cause: Error) => void
		mocks.manageSet.mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					fail = reject
				}),
		)
		setup()
		await screen.findByRole('button', { name: 'Edit Cabo' })
		fireEvent.change(screen.getByLabelText('Show palettes'), {
			target: { value: 'set-one' },
		})
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select Cabo' }))
		fireEvent.change(screen.getByLabelText('Assign selected to set'), {
			target: { value: 'set-one' },
		})
		fireEvent.click(
			screen.getByRole('button', { name: 'Assign 1 selected' }),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(mocks.manageSet).not.toHaveBeenCalled()
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(screen.getByLabelText('Show palettes')).toHaveValue('set-one')
		expect(
			screen.getByRole('checkbox', { name: 'Select Cabo' }),
		).toBeChecked()
		expect(screen.getByLabelText('Assign selected to set')).toHaveValue(
			'set-one',
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Assign 1 selected' }),
		)
		const dialog = screen.getByRole('dialog')
		fireEvent.click(
			within(dialog).getByRole('button', { name: 'Assign palettes' }),
		)
		expect(within(dialog).getByRole('status')).toHaveTextContent(
			'Assigning palettes to set…',
		)
		fireEvent.click(
			within(dialog).getByRole('button', { name: 'Assign palettes' }),
		)
		fireEvent(dialog, new Event('cancel', { cancelable: true }))
		expect(screen.getByRole('dialog')).toBe(dialog)
		expect(mocks.manageSet).toHaveBeenCalledOnce()
		await act(async () => fail(new Error('Assignment failed')))
		expect(within(dialog).getByRole('alert')).toHaveTextContent(
			'Assignment failed',
		)
		expect(
			screen.getByRole('checkbox', { name: 'Select Cabo' }),
		).toBeChecked()
		expect(screen.getByLabelText('Assign selected to set')).toHaveValue(
			'set-one',
		)
		expect(
			within(dialog).getByRole('button', { name: 'Assign palettes' }),
		).toBeEnabled()
	})

	it('allows confirmed deletion of a palette belonging only to a draft set', async () => {
		mocks.sets.mockResolvedValue([paletteSet])
		mocks.usage.mockResolvedValue({
			...emptyUsage,
			packs: ['Warm colors'],
			preparedPacks: 0,
		})
		setup()
		fireEvent.click(
			await screen.findByRole('button', { name: 'Delete Cabo' }),
		)
		await screen.findByText('Warm colors')
		expect(
			await screen.findByRole('button', {
				name: 'Confirm delete palette',
			}),
		).toBeEnabled()
		fireEvent.click(
			screen.getByRole('button', { name: 'Confirm delete palette' }),
		)
		await screen.findByText('Deleted "Cabo".')
		expect(mocks.manage).toHaveBeenCalledWith(client, {
			kind: 'delete',
			previous: scheme,
		})
	})

	it('creates Undecided sets over the list with retry-stable IDs and returns to Add, leaving editing separate', async () => {
		const { isProtected } = setup()
		await openSets()
		fireEvent.click(screen.getByRole('button', { name: 'New palette set' }))
		expect(screen.getByLabelText('Set label')).toHaveValue('undecided')
		fireEvent.change(screen.getByLabelText('Set name'), {
			target: { value: 'New colors' },
		})
		expect(isProtected()).toBe(true)
		expect(
			screen.getByRole('dialog', { name: 'New palette set' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('heading', { name: 'Palette sets' }),
		).toBeInTheDocument()
		expect(screen.getByLabelText('Set name')).toHaveValue('New colors')
		mocks.manageSet.mockRejectedValueOnce(new Error('Lost response'))
		fireEvent.click(screen.getByRole('button', { name: 'Save set' }))
		await screen.findByText('Lost response')
		const args = mocks.manageSet.mock.calls[0]
		expect(args).toEqual([
			client,
			expect.any(String),
			{ kind: 'create', name: 'New colors', role: 'undecided' },
		])
		mocks.sets.mockResolvedValue([
			{
				...paletteSet,
				row: { ...paletteSet.row, id: args[1], name: 'New colors' },
				members: [],
			},
		])
		fireEvent.click(screen.getByRole('button', { name: 'Save set' }))
		await screen.findByText('Palette set created.')
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'New palette set' }),
			).toBeEnabled(),
		)
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(mocks.manageSet.mock.calls[1]).toEqual(args)
		await waitFor(() => expect(isProtected()).toBe(false))
		fireEvent.click(screen.getByRole('button', { name: 'New palette set' }))
		expect(screen.getByLabelText('Set name')).toHaveValue('')
		expect(screen.getByLabelText('Set label')).toHaveValue('undecided')
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		fireEvent.click(
			screen.getByRole('button', { name: 'Edit set New colors' }),
		)
		fireEvent.change(screen.getByLabelText('Set label'), {
			target: { value: 'reward' },
		})
		expect(isProtected()).toBe(true)
		fireEvent.click(screen.getByRole('button', { name: 'Save set' }))
		await screen.findByText('Set details saved.')
		expect(mocks.manageSet).toHaveBeenLastCalledWith(client, args[1], {
			kind: 'update',
			name: 'New colors',
			role: 'reward',
		})
	})

	it('stages member order until Save order, removes immediately, and deletes a set only after confirmation', async () => {
		const second = { ...scheme, id: 'other', name: 'Other colors' }
		mocks.sets.mockResolvedValue([
			{ ...paletteSet, members: [scheme, second] },
		])
		const { isProtected } = setup()
		await openSets()
		fireEvent.click(
			screen.getByRole('button', { name: 'Edit set Warm colors' }),
		)
		const saveOrder = screen.getByRole('button', { name: 'Save order' })
		expect(saveOrder).toBeDisabled()
		fireEvent.keyDown(
			screen.getByRole('button', { name: 'Reorder Cabo' }),
			{ key: 'ArrowDown' },
		)
		fireEvent.keyDown(
			screen.getByRole('button', { name: 'Reorder Cabo' }),
			{ key: 'ArrowUp' },
		)
		fireEvent.keyDown(
			screen.getByRole('button', { name: 'Reorder Cabo' }),
			{ key: 'End' },
		)
		expect(
			within(screen.getByRole('list')).getAllByRole('listitem')[1],
		).toHaveTextContent('Cabo')
		expect(mocks.manageSet).not.toHaveBeenCalled()
		expect(isProtected()).toBe(true)
		fireEvent.click(saveOrder)
		await screen.findByText('Palette order saved.')
		expect(mocks.manageSet).toHaveBeenCalledOnce()
		expect(mocks.manageSet).toHaveBeenLastCalledWith(client, 'set-one', {
			kind: 'reorder',
			paletteIds: ['other', 'cabo'],
		})
		expect(mocks.sets).toHaveBeenCalledOnce()
		expect(isProtected()).toBe(false)
		expect(saveOrder).toBeDisabled()
		mocks.sets.mockResolvedValue([{ ...paletteSet, members: [second] }])
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Remove Cabo from set' }),
			).toBeEnabled(),
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove Cabo from set' }),
		)
		await screen.findByText(/Palette removed/)
		expect(mocks.manageSet).toHaveBeenLastCalledWith(client, 'set-one', {
			kind: 'remove',
			paletteIds: ['cabo'],
		})
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Back to sets' }),
			).toBeEnabled(),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Back to sets' }))
		fireEvent.click(
			screen.getByRole('button', { name: 'Delete set Warm colors' }),
		)
		expect(
			screen.getByText(/palettes will remain in the library/),
		).toBeInTheDocument()
		expect(mocks.manageSet).toHaveBeenCalledTimes(2)
		fireEvent.click(
			screen.getByRole('button', { name: 'Confirm delete set' }),
		)
		await screen.findByText(
			'Set deleted. Its palettes remain in the library.',
		)
		expect(mocks.manageSet).toHaveBeenLastCalledWith(client, 'set-one', {
			kind: 'delete',
		})
		expect(mocks.manage).not.toHaveBeenCalled()
	})

	it('keeps prepared sets read-only and prevents selecting their members for moves', async () => {
		mocks.sets.mockResolvedValue([
			{
				...paletteSet,
				row: {
					...paletteSet.row,
					published_at: '2026-01-01',
					release_at: '2099-01-01',
				},
			},
		])
		setup()
		expect(
			await screen.findByRole('checkbox', { name: 'Select Cabo' }),
		).toBeDisabled()
		fireEvent.click(screen.getByRole('button', { name: 'Sets' }))
		expect(
			screen.getByRole('button', { name: 'Delete set Warm colors' }),
		).toBeDisabled()
		fireEvent.click(
			screen.getByRole('button', { name: 'Edit set Warm colors' }),
		)
		expect(screen.getByLabelText('Set name')).toBeDisabled()
		expect(screen.getByLabelText('Set label')).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Remove Cabo from set' }),
		).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Reorder Cabo' }),
		).toBeDisabled()
		expect(
			screen.queryByRole('button', { name: 'Save set' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Save order' }),
		).not.toBeInTheDocument()
	})

	it('surfaces a set reload failure and supports retry without losing metadata edits', async () => {
		mocks.sets.mockResolvedValue([paletteSet])
		setup()
		await openSets()
		fireEvent.click(
			screen.getByRole('button', { name: 'Edit set Warm colors' }),
		)
		fireEvent.change(screen.getByLabelText('Set name'), {
			target: { value: 'Renamed colors' },
		})
		mocks.sets.mockRejectedValueOnce(new Error('Membership read failed'))
		fireEvent.click(screen.getByRole('button', { name: 'Save set' }))
		await screen.findByText(/Membership read failed/)
		expect(screen.getByLabelText('Set name')).toHaveValue('Renamed colors')
		expect(screen.getByRole('button', { name: 'Save set' })).toBeDisabled()
		expect(mocks.manageSet).toHaveBeenCalledTimes(1)
		fireEvent.click(
			screen.getByRole('button', { name: 'Retry loading sets' }),
		)
		await waitFor(() =>
			expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
		)
		expect(screen.getByLabelText('Set name')).toHaveValue('Renamed colors')
		fireEvent.change(screen.getByLabelText('Set label'), {
			target: { value: 'paid' },
		})
		expect(screen.getByLabelText('Set label')).toHaveValue('paid')
	})

	it.each([false, true])(
		'duplicates colors into an unnamed new draft without copying identity or release state (published: %s)',
		async published => {
			const source: CatalogScheme = {
				...scheme,
				id: 'source',
				name: 'Source',
				colors: ['#abcdef', '#123456', '#abcdef', '#fedcba', '#654321'],
				published_at: published ? '2000-01-01' : null,
				release_at: published ? '2000-01-01' : null,
			}
			mocks.load.mockResolvedValue([scheme, source])
			setup()
			fireEvent.click(
				await screen.findByRole('button', { name: 'Duplicate Source' }),
			)
			expect(
				screen.getByRole('heading', { name: 'New palette' }),
			).toBeInTheDocument()
			expect(screen.getByLabelText('Palette name')).toHaveValue('')
			for (const [index, color] of source.colors.entries())
				expect(screen.getByLabelText(`Color ${index + 1}`)).toHaveValue(
					color,
				)
			expect(
				screen.getByRole('button', { name: 'Save palette' }),
			).toBeDisabled()
			expect(mocks.usage).not.toHaveBeenCalled()
			expect(mocks.manage).not.toHaveBeenCalled()
			fireEvent.change(screen.getByLabelText('Palette name'), {
				target: { value: 'My variation' },
			})
			fireEvent.click(
				screen.getByRole('button', { name: 'Save palette' }),
			)
			await screen.findByText('Saved "My variation" as a draft palette.')
			const request = mocks.manage.mock.calls[0][1]
			expect(request).toEqual({
				kind: 'create',
				id: expect.any(String),
				scheme: { name: 'My variation', colors: source.colors },
			})
			expect(request.id).not.toBe(source.id)
		},
	)

	it('shows draft, scheduled, and live palettes and keeps prepared ones read-only', async () => {
		mocks.load.mockResolvedValue([
			scheme,
			{
				...scheme,
				id: 'scheduled',
				name: 'Scheduled art',
				published_at: '2026-01-01',
				release_at: '2099-01-01',
			},
			{
				...scheme,
				id: 'live',
				name: 'Live art',
				published_at: '2000-01-01',
				release_at: '2000-01-01',
			},
		])
		setup()
		expect(await screen.findByText('Draft')).toBeInTheDocument()
		expect(screen.getByText('Scheduled')).toBeInTheDocument()
		expect(screen.getByText('Live')).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Delete Scheduled art' }),
		).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Delete Live art' }),
		).toBeDisabled()
		fireEvent.click(
			screen.getByRole('button', { name: 'View Scheduled art' }),
		)
		expect(screen.getByLabelText('Palette name')).toBeDisabled()
		expect(screen.getByLabelText('Color 1')).toBeDisabled()
		expect(
			screen.queryByRole('button', { name: 'Save palette' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Delete palette' }),
		).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Randomize' })).toBeEnabled()
		expect(mocks.manage).not.toHaveBeenCalled()
	})

	it('creates a palette with a retry-stable ID and reloads after a successful save', async () => {
		const { isProtected } = setup()
		fireEvent.click(
			await screen.findByRole('button', { name: 'New palette' }),
		)
		expect(
			screen.getByRole('img', { name: 'Palette sandbox design' }),
		).toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: ' New art ' },
		})
		expect(isProtected()).toBe(true)
		mocks.manage.mockRejectedValueOnce(new Error('Response lost'))
		fireEvent.click(screen.getByRole('button', { name: 'Save palette' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Response lost',
		)
		expect(screen.getByLabelText('Palette name')).toHaveValue(' New art ')
		const firstRequest = mocks.manage.mock.calls[0][1]
		expect(firstRequest).toMatchObject({
			kind: 'create',
			scheme: { name: 'New art', colors: scheme.colors },
		})
		expect(firstRequest.id).toMatch(/^[0-9a-f-]{36}$/)
		mocks.load.mockResolvedValue([
			scheme,
			{ ...scheme, id: firstRequest.id, name: 'New art' },
		])
		fireEvent.click(screen.getByRole('button', { name: 'Save palette' }))
		expect(
			await screen.findByText('Saved "New art" as a draft palette.'),
		).toBeInTheDocument()
		expect(mocks.manage.mock.calls[1][1]).toEqual(firstRequest)
		expect(
			await screen.findByRole('button', { name: 'Edit New art' }),
		).toBeInTheDocument()
		expect(isProtected()).toBe(false)
	})

	it('retains invalid text, blocks save, and restores the same sandbox pattern after correction', async () => {
		setup()
		await openEditor()
		const original = sandboxFills()
		const first = screen.getByLabelText('Color 1')
		fireEvent.change(first, { target: { value: '#12' } })
		expect(first).toHaveValue('#12')
		expect(first).toHaveAttribute('aria-invalid', 'true')
		expect(
			screen.getByRole('button', { name: 'Save palette' }),
		).toBeDisabled()
		expect(
			screen.queryByRole('img', { name: 'Palette sandbox design' }),
		).not.toBeInTheDocument()
		fireEvent.change(first, { target: { value: scheme.colors[0] } })
		expect(sandboxFills()).toEqual(original)
		fireEvent.change(screen.getByLabelText('Pick color 1'), {
			target: { value: '#abcdef' },
		})
		expect(first).toHaveValue('#abcdef')
		expect(sandboxFills()).toEqual(
			original.map(color =>
				color === scheme.colors[0] ? '#abcdef' : color,
			),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Save palette' }))
		await screen.findByRole('heading', { name: 'Palettes' })
		expect(mocks.manage).toHaveBeenCalledWith(client, {
			kind: 'update',
			previous: scheme,
			scheme: {
				name: 'Cabo',
				colors: ['#abcdef', ...scheme.colors.slice(1)],
			},
		})
	})

	it('preserves a conflicting edit and guards leaving through Back and browser close', async () => {
		const { isProtected } = setup()
		await openEditor()
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: 'Revised' },
		})
		mocks.manage.mockRejectedValue(
			new Error('Refresh and review before retrying.'),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Save palette' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Refresh and review',
		)
		expect(screen.getByLabelText('Palette name')).toHaveValue('Revised')
		fireEvent.click(
			screen.getByRole('button', { name: 'Back to palettes' }),
		)
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		expect(screen.getByLabelText('Palette name')).toHaveValue('Revised')
		const event = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(event)
		expect(event.defaultPrevented).toBe(true)
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		expect(
			screen.getByRole('heading', { name: 'Palettes' }),
		).toBeInTheDocument()
		expect(isProtected()).toBe(false)
	})

	it('loads usage before confirming named deletion and reloads after success', async () => {
		setup()
		fireEvent.click(
			await screen.findByRole('button', { name: 'Delete Cabo' }),
		)
		const confirm = await screen.findByRole('dialog', {
			name: 'Confirm palette deletion',
		})
		expect(
			within(confirm).getByText(/Delete "Cabo" permanently/),
		).toBeInTheDocument()
		expect(mocks.manage).not.toHaveBeenCalled()
		expect(
			screen.queryByRole('form', { name: 'Edit palette' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('heading', { name: 'Palettes' }),
		).toBeInTheDocument()
		fireEvent.click(
			within(confirm).getByRole('button', { name: 'Cancel deletion' }),
		)
		expect(
			screen.queryByRole('dialog', { name: 'Confirm palette deletion' }),
		).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Delete Cabo' }))
		mocks.load.mockResolvedValue([])
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Confirm delete palette' }),
			).toBeEnabled(),
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Confirm delete palette' }),
		)
		expect(await screen.findByText('Deleted "Cabo".')).toBeInTheDocument()
		expect(mocks.manage).toHaveBeenCalledWith(client, {
			kind: 'delete',
			previous: scheme,
		})
		await screen.findByText(
			'No palettes yet. Create a draft to get started.',
		)
	})

	it('shows saved puzzle previews and all distribution references without enabling deletion', async () => {
		mocks.usage.mockResolvedValue({
			puzzles: [
				{
					id: 'puzzle',
					name: 'Linked art',
					context: 'First set',
					preview: { radius: 3, target: { '0,0': 0 } },
				},
			],
			rewards: ['First set / Hard route'],
			packs: ['Earth tones'],
			starters: 1,
			grants: 2,
			corrections: 3,
		})
		setup()
		fireEvent.click(
			await screen.findByRole('button', { name: 'Delete Cabo' }),
		)
		expect(
			await screen.findByText(/This palette is in use/),
		).toBeInTheDocument()
		expect(screen.getByText('First set / Hard route')).toBeInTheDocument()
		expect(screen.getByText('Earth tones')).toBeInTheDocument()
		expect(
			screen.getByText('Included in starter offerings.'),
		).toBeInTheDocument()
		expect(screen.getByText('Ownership grants: 2')).toBeInTheDocument()
		expect(
			screen.getByText('Correction history records: 3'),
		).toBeInTheDocument()
		const preview = screen.getByRole('img', {
			name: 'Linked art palette preview',
		})
		const center = preview.querySelector('polygon[fill="#112233"]')
		expect(center).not.toBeNull()
		expect(
			screen.getByRole('button', { name: 'Confirm delete palette' }),
		).toBeDisabled()
	})

	it('blocks deletion on failed usage reads and supports an explicit retry', async () => {
		mocks.usage.mockRejectedValueOnce(new Error('Offline'))
		setup()
		fireEvent.click(
			await screen.findByRole('button', { name: 'Delete Cabo' }),
		)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Loading palette usage…',
		)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Deletion is disabled',
		)
		expect(
			screen.getByRole('button', { name: 'Confirm delete palette' }),
		).toBeDisabled()
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('button', { name: 'Retry palette usage' }),
		)
		await screen.findByText(/No saved references/)
		expect(
			screen.getByRole('button', { name: 'Confirm delete palette' }),
		).toBeEnabled()
	})

	it('reports a failed write-time deletion and retains the record', async () => {
		mocks.manage.mockRejectedValueOnce(
			new Error('A puzzle now references this palette.'),
		)
		setup()
		fireEvent.click(
			await screen.findByRole('button', { name: 'Delete Cabo' }),
		)
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Confirm delete palette',
			}),
		)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'A puzzle now references',
		)
		const dialog = screen.getByRole('dialog', {
			name: 'Confirm palette deletion',
		})
		expect(within(dialog).getByRole('alert')).toHaveTextContent(
			'A puzzle now references',
		)
		expect(
			screen.getByRole('listitem', { name: 'Palette Cabo' }),
		).toBeInTheDocument()
	})

	it('keeps palette filter and selection mounted across deletion cancellation and failed writes, and blocks pending dismissal', async () => {
		mocks.sets.mockResolvedValue([paletteSet])
		let fail!: (cause: Error) => void
		mocks.manage.mockReturnValueOnce(
			new Promise((_resolve, reject) => {
				fail = reject
			}),
		)
		setup()
		await screen.findByRole('checkbox', { name: 'Select Cabo' })
		fireEvent.change(screen.getByLabelText('Show palettes'), {
			target: { value: 'set-one' },
		})
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select Cabo' }))
		const card = screen.getByRole('listitem', { name: 'Palette Cabo' })
		fireEvent.click(screen.getByRole('button', { name: 'Delete Cabo' }))
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Confirm delete palette' }),
			).toBeEnabled(),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Cancel deletion' }))
		expect(screen.getByRole('listitem', { name: 'Palette Cabo' })).toBe(
			card,
		)
		expect(screen.getByLabelText('Show palettes')).toHaveValue('set-one')
		expect(
			screen.getByRole('checkbox', { name: 'Select Cabo' }),
		).toBeChecked()
		expect(mocks.manage).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: 'Delete Cabo' }))
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Confirm delete palette' }),
			).toBeEnabled(),
		)
		const dialog = screen.getByRole('dialog', {
			name: 'Confirm palette deletion',
		})
		fireEvent.click(
			screen.getByRole('button', { name: 'Confirm delete palette' }),
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Confirm delete palette' }),
		)
		expect(mocks.manage).toHaveBeenCalledOnce()
		fireEvent(dialog, new Event('cancel', { cancelable: true }))
		fireEvent.click(dialog)
		expect(dialog).toHaveAttribute('open')
		expect(
			screen.getByRole('button', { name: 'Close palette deletion' }),
		).toBeDisabled()
		await act(async () => {
			fail(new Error('Now referenced'))
		})
		expect(within(dialog).getByRole('alert')).toHaveTextContent(
			'Now referenced',
		)
		expect(screen.getByRole('listitem', { name: 'Palette Cabo' })).toBe(
			card,
		)
		expect(
			screen.getByRole('checkbox', { name: 'Select Cabo' }),
		).toBeChecked()
	})

	it('opens editor deletion over unsaved edits and retains the independent usage preview on cancel', async () => {
		mocks.usage.mockResolvedValue({
			...emptyUsage,
			puzzles: [],
		})
		setup()
		await openEditor()
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: 'Unsaved name' },
		})
		fireEvent.change(screen.getByLabelText('Color 1'), {
			target: { value: '#abcdef' },
		})
		const sandbox = screen.getByRole('img', {
			name: 'Palette sandbox design',
		})
		fireEvent.click(screen.getByRole('button', { name: 'Delete palette' }))
		const dialog = screen.getByRole('dialog', {
			name: 'Confirm palette deletion',
		})
		expect(dialog).toHaveTextContent(
			'Unsaved edits will also be discarded.',
		)
		await waitFor(() =>
			expect(
				within(dialog).getByRole('button', {
					name: 'Confirm delete palette',
				}),
			).toBeEnabled(),
		)
		expect(mocks.usage).toHaveBeenCalledTimes(2)
		fireEvent.click(
			within(dialog).getByRole('button', { name: 'Cancel deletion' }),
		)
		expect(screen.getByLabelText('Palette name')).toHaveValue(
			'Unsaved name',
		)
		expect(screen.getByLabelText('Color 1')).toHaveValue('#abcdef')
		expect(
			screen.getByRole('img', { name: 'Palette sandbox design' }),
		).toBe(sandbox)
		expect(mocks.manage).not.toHaveBeenCalled()
	})

	it('reports catalog load failures and retries instead of showing an empty success', async () => {
		mocks.load.mockRejectedValueOnce(new Error('Catalog offline'))
		setup()
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Catalog offline',
		)
		expect(
			screen.queryByText(
				'No palettes yet. Create a draft to get started.',
			),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'New palette' }),
		).toBeDisabled()
		fireEvent.click(
			screen.getByRole('button', { name: 'Refresh palette catalog' }),
		)
		await screen.findByRole('button', { name: 'Edit Cabo' })
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
	})

	it('prevents duplicate submissions while a save is pending', async () => {
		let finish!: () => void
		mocks.manage.mockImplementation(
			() =>
				new Promise<void>(resolve => {
					finish = resolve
				}),
		)
		setup()
		await openEditor()
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: 'Updated' },
		})
		const form = screen.getByRole('form', { name: 'Edit palette' })
		fireEvent.submit(form)
		fireEvent.submit(form)
		expect(mocks.manage).toHaveBeenCalledOnce()
		expect(screen.getByRole('status')).toHaveTextContent('Saving palette…')
		expect(screen.getByRole('status').querySelector('img')).toHaveAttribute(
			'aria-hidden',
			'true',
		)
		expect(
			screen.getByRole('button', { name: 'Back to palettes' }),
		).toBeDisabled()
		finish()
		await waitFor(() =>
			expect(
				screen.getByRole('heading', { name: 'Palettes' }),
			).toBeInTheDocument(),
		)
		const success = screen.getByText('Saved "Updated" as a draft palette.')
		expect(success).toHaveAttribute('role', 'status')
		expect(success.querySelector('img')).toBeNull()
	})

	it('uses one shared catalog status for initial and empty-catalog refresh reads, then clears it on failure', async () => {
		let finish!: (schemes: readonly CatalogScheme[]) => void
		mocks.load.mockReturnValueOnce(
			new Promise(resolve => {
				finish = resolve
			}),
		)
		setup()
		expect(screen.getByRole('status')).toHaveTextContent(
			'Loading palettes…',
		)
		expect(screen.getByRole('status').querySelector('img')).toHaveAttribute(
			'aria-hidden',
			'true',
		)
		expect(
			screen.getByRole('button', { name: 'New palette' }),
		).toBeDisabled()
		await act(async () => {
			finish([])
		})
		expect(
			screen.getByText('No palettes yet. Create a draft to get started.'),
		).toBeInTheDocument()
		let fail!: (cause: Error) => void
		mocks.load.mockReturnValueOnce(
			new Promise((_resolve, reject) => {
				fail = reject
			}),
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Refresh palette catalog' }),
		)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Refreshing palettes…',
		)
		expect(
			screen.queryByRole('button', { name: 'Edit Cabo' }),
		).not.toBeInTheDocument()
		await act(async () => {
			fail(new Error('Catalog offline'))
		})
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		expect(screen.getByRole('alert')).toHaveTextContent('Catalog offline')
		expect(screen.queryByText(/No palettes yet/)).not.toBeInTheDocument()
	})
})
