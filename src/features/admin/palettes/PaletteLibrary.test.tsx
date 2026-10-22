import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import {
	renderWithNavigationGuard as render,
	clickWhenEnabled,
} from '@/features/admin/testing'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/supabase'
import type {
	CatalogPalette,
	PaletteUsage,
	PaletteGroup,
} from '@/features/admin/services'
import PaletteLibrary from './PaletteLibrary'
import { useState } from 'react'
import { useNavigationGuard } from '@/ui/navigation'

const mocks = vi.hoisted(() => ({
	load: vi.fn(),
	manage: vi.fn(),
	usage: vi.fn(),
	groups: vi.fn(),
	manageGroup: vi.fn(),
	bulkDelete: vi.fn(),
}))
vi.mock('@/features/admin/services/paletteGroups', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/paletteGroups')
	>()),
	loadPaletteGroups: (...args: unknown[]) => mocks.groups(...args),
	managePaletteGroup: (...args: unknown[]) => mocks.manageGroup(...args),
}))
vi.mock('@/features/admin/services/palettes', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/palettes')
	>()),
	loadPalettes: (...args: unknown[]) => mocks.load(...args),
	managePalette: (...args: unknown[]) => mocks.manage(...args),
	bulkDeletePalettes: (...args: unknown[]) => mocks.bulkDelete(...args),
}))
vi.mock('@/features/admin/services/paletteUsage', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/paletteUsage')
	>()),
	loadPaletteUsage: (...args: unknown[]) => mocks.usage(...args),
}))
const client = {} as SupabaseClient<Database>
const samplePalette: CatalogPalette = {
	id: 'cabo',
	name: 'Cabo',
	colors: ['#112233', '#223344', '#334455', '#445566', '#556677'],
	revision: 1,
	published_at: null,
	release_at: null,
}
const emptyUsage: PaletteUsage = {
	puzzles: [],
	rewards: [],
	groups: [],
	grants: 0,
	corrections: 0,
}
const paletteGroup: PaletteGroup = {
	row: {
		id: 'set-one',
		name: 'Warm colors',
		purpose: 'undecided',
		published_at: null,
		release_at: null,
	},
	purpose: 'undecided',
	members: [samplePalette],
}
beforeEach(() => {
	vi.resetAllMocks()
	mocks.load.mockResolvedValue([samplePalette])
	mocks.manage.mockResolvedValue(undefined)
	mocks.usage.mockResolvedValue(emptyUsage)
	mocks.groups.mockResolvedValue([])
	mocks.manageGroup.mockResolvedValue(undefined)
})
afterEach(() => vi.restoreAllMocks())

async function openEditor() {
	fireEvent.click(await screen.findByRole('button', { name: 'Edit Cabo' }))
	await screen.findByText('Not used anywhere.')
}
async function openGroups() {
	await screen.findByRole('button', { name: 'Edit Cabo' })
	fireEvent.click(screen.getByRole('button', { name: 'Groups' }))
}
// Mirrors AdminWorkspace: choosing any tab is guarded and remounts the view.
function PaletteWorkspace() {
	const { requestNavigation } = useNavigationGuard()
	const [view, setView] = useState<'groups' | 'palettes'>('palettes')
	const [visit, setVisit] = useState(0)
	function go(next: 'groups' | 'palettes') {
		requestNavigation(() => {
			setView(next)
			setVisit(n => n + 1)
		})
	}
	return (
		<>
			<button onClick={() => go('groups')}>Groups</button>
			<button onClick={() => go('palettes')}>Palette catalog</button>
			<PaletteLibrary
				key={`${view}-${visit}`}
				client={client}
				view={view}
			/>
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
	it('filters grouped palettes and atomically moves selected palettes into a draft group', async () => {
		mocks.groups.mockResolvedValue([
			paletteGroup,
			{
				...paletteGroup,
				row: {
					...paletteGroup.row,
					id: 'set-two',
					name: 'Pack colors',
				},
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
		fireEvent.click(screen.getByRole('button', { name: 'Assign to group' }))
		const assignment = screen.getByRole('dialog', {
			name: 'Assign selected palettes to group',
		})
		expect(
			within(assignment).getByRole('button', { name: 'Assign palettes' }),
		).toBeDisabled()
		fireEvent.change(within(assignment).getByLabelText('Palette group'), {
			target: { value: 'set-two' },
		})
		expect(assignment).toHaveTextContent('Cabo')
		expect(mocks.manageGroup).not.toHaveBeenCalled()
		fireEvent.click(
			within(assignment).getByRole('button', { name: 'Assign palettes' }),
		)
		await screen.findByText(/Palettes assigned/)
		expect(mocks.manageGroup).toHaveBeenCalledExactlyOnceWith(
			client,
			'set-two',
			{ kind: 'assign', paletteIds: ['cabo'] },
		)
		await waitFor(() =>
			expect(
				screen.getByRole('checkbox', { name: 'Select Cabo' }),
			).not.toBeChecked(),
		)
		expect(
			screen.queryByRole('group', { name: 'Bulk palette actions' }),
		).not.toBeInTheDocument()
	})

	it('unassigns selected palettes from each of their groups and hides the action for unassigned palettes', async () => {
		const ember = { ...samplePalette, id: 'ember', name: 'Ember' }
		const loose = { ...samplePalette, id: 'loose', name: 'Loose' }
		mocks.load.mockResolvedValue([samplePalette, ember, loose])
		mocks.groups.mockResolvedValue([
			paletteGroup,
			{
				...paletteGroup,
				row: {
					...paletteGroup.row,
					id: 'set-two',
					name: 'Pack colors',
				},
				members: [ember],
			},
		])
		render(<PaletteLibrary client={client} view="palettes" />)
		await screen.findByRole('button', { name: 'Edit Cabo' })
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select Cabo' }))
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select Loose' }))
		expect(
			screen.queryByRole('button', { name: 'Unassign from groups' }),
		).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select Loose' }))
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select Ember' }))
		fireEvent.click(
			screen.getByRole('button', { name: 'Unassign from groups' }),
		)
		const dialog = screen.getByRole('dialog', {
			name: 'Unassign selected palettes',
		})
		expect(mocks.manageGroup).not.toHaveBeenCalled()
		fireEvent.click(
			within(dialog).getByRole('button', { name: 'Unassign palettes' }),
		)
		await screen.findByText(/Unassigned 2 palettes/)
		expect(mocks.manageGroup).toHaveBeenCalledTimes(2)
		expect(mocks.manageGroup).toHaveBeenCalledWith(client, 'set-one', {
			kind: 'remove',
			paletteIds: ['cabo'],
		})
		expect(mocks.manageGroup).toHaveBeenCalledWith(client, 'set-two', {
			kind: 'remove',
			paletteIds: ['ember'],
		})
	})

	it('keeps the unassignment dialog open with the error when a removal fails', async () => {
		mocks.groups.mockResolvedValue([paletteGroup])
		render(
			<PaletteLibrary
				client={client}
				view="palettes"
				catalogStatus="assigned"
			/>,
		)
		fireEvent.click(
			await screen.findByRole('checkbox', { name: 'Select Cabo' }),
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Unassign from groups' }),
		)
		mocks.manageGroup.mockRejectedValueOnce(new Error('Set changed'))
		fireEvent.click(
			screen.getByRole('button', { name: 'Unassign palettes' }),
		)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Set changed',
		)
		expect(
			screen.getByRole('dialog', { name: 'Unassign selected palettes' }),
		).toBeInTheDocument()
	})

	it('retains the palette filter, selection, and assignment target on cancellation or write failure', async () => {
		mocks.groups.mockResolvedValue([paletteGroup])
		let fail!: (cause: Error) => void
		mocks.manageGroup.mockImplementationOnce(
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
		fireEvent.click(screen.getByRole('button', { name: 'Assign to group' }))
		fireEvent.change(screen.getByLabelText('Palette group'), {
			target: { value: 'set-one' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(mocks.manageGroup).not.toHaveBeenCalled()
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(screen.getByLabelText('Show palettes')).toHaveValue('set-one')
		expect(
			screen.getByRole('checkbox', { name: 'Select Cabo' }),
		).toBeChecked()
		fireEvent.click(screen.getByRole('button', { name: 'Assign to group' }))
		const dialog = screen.getByRole('dialog')
		fireEvent.change(within(dialog).getByLabelText('Palette group'), {
			target: { value: 'set-one' },
		})
		fireEvent.click(
			within(dialog).getByRole('button', { name: 'Assign palettes' }),
		)
		expect(within(dialog).getByRole('status')).toHaveTextContent(
			'Assigning palettes to group…',
		)
		fireEvent.click(
			within(dialog).getByRole('button', { name: 'Assign palettes' }),
		)
		fireEvent(dialog, new Event('cancel', { cancelable: true }))
		expect(screen.getByRole('dialog')).toBe(dialog)
		expect(mocks.manageGroup).toHaveBeenCalledOnce()
		await act(async () => fail(new Error('Assignment failed')))
		expect(within(dialog).getByRole('alert')).toHaveTextContent(
			'Assignment failed',
		)
		expect(
			screen.getByRole('checkbox', { name: 'Select Cabo' }),
		).toBeChecked()
		expect(within(dialog).getByLabelText('Palette group')).toHaveValue(
			'set-one',
		)
		expect(
			within(dialog).getByRole('button', { name: 'Assign palettes' }),
		).toBeEnabled()
	})

	it('selects all shown palettes and highlights selected cards', async () => {
		const loose = { ...samplePalette, id: 'loose', name: 'Loose' }
		mocks.load.mockResolvedValue([samplePalette, loose])
		setup()
		const selectAll = await screen.findByRole('checkbox', {
			name: 'Select all',
		})
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select Cabo' }))
		expect(selectAll).toBePartiallyChecked()
		expect(
			screen.getByRole('listitem', { name: 'Palette Cabo' }),
		).toHaveAttribute('data-selected', 'true')
		fireEvent.click(selectAll)
		expect(
			screen.getByRole('checkbox', { name: 'Select Loose' }),
		).toBeChecked()
		fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
		expect(
			screen.getByRole('checkbox', { name: 'Select Cabo' }),
		).not.toBeChecked()
		expect(
			screen.queryByRole('group', { name: 'Bulk palette actions' }),
		).not.toBeInTheDocument()
	})

	it('orders assigned palettes by group name, then position within the group', async () => {
		const palette = (id: string, name: string) => ({
			...samplePalette,
			id,
			name,
		})
		const [a1, a2, b1] = [
			palette('a1', 'Zebra'),
			palette('a2', 'Apple'),
			palette('b1', 'Mango'),
		]
		mocks.load.mockResolvedValue([a2, b1, a1])
		mocks.groups.mockResolvedValue([
			{
				...paletteGroup,
				row: { ...paletteGroup.row, id: 'beta', name: 'Beta' },
				members: [b1],
			},
			{
				...paletteGroup,
				row: { ...paletteGroup.row, id: 'alpha', name: 'Alpha' },
				members: [a1, a2],
			},
		])
		render(
			<PaletteLibrary
				client={client}
				view="palettes"
				catalogStatus="assigned"
			/>,
		)
		await screen.findByRole('button', { name: 'Edit Zebra' })
		expect(
			screen
				.getAllByRole('listitem', { name: /^Palette / })
				.map(item => item.getAttribute('aria-label')),
		).toEqual(['Palette Zebra', 'Palette Apple', 'Palette Mango'])
	})

	it('offers New palette in the Assigned view only while filtered to a draft group, and assigns the new palette to it', async () => {
		const prepared = {
			...paletteGroup,
			row: {
				...paletteGroup.row,
				id: 'live-set',
				name: 'Live',
				published_at: '2026-01-01T00:00:00Z',
			},
			members: [],
		}
		mocks.groups.mockResolvedValue([paletteGroup, prepared])
		render(
			<PaletteLibrary
				client={client}
				view="palettes"
				catalogStatus="assigned"
			/>,
		)
		await screen.findByRole('button', { name: 'Edit Cabo' })
		expect(
			screen.queryByRole('option', { name: 'No group' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'New palette' }),
		).not.toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Show palettes'), {
			target: { value: 'live-set' },
		})
		expect(
			screen.queryByRole('button', { name: 'New palette' }),
		).not.toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Show palettes'), {
			target: { value: 'set-one' },
		})
		await clickWhenEnabled('New palette')
		expect(
			screen.getByText('This palette will be added to "Warm colors".'),
		).toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: 'Ember' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		expect(
			await screen.findByText(
				'Saved "Ember" as a draft palette in "Warm colors".',
			),
		).toBeInTheDocument()
		const created = mocks.manage.mock.calls[0][1]
		expect(mocks.manageGroup).toHaveBeenCalledWith(client, 'set-one', {
			kind: 'assign',
			paletteIds: [created.id],
		})
		expect(screen.getByLabelText('Show palettes')).toHaveValue('set-one')
	})

	it('keeps New palette unassigned from the Unassigned view', async () => {
		mocks.groups.mockResolvedValue([paletteGroup])
		render(
			<PaletteLibrary
				client={client}
				view="palettes"
				catalogStatus="drafts"
			/>,
		)
		await clickWhenEnabled('New palette')
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: 'Loose' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		expect(
			await screen.findByText('Saved "Loose" as a draft palette.'),
		).toBeInTheDocument()
		expect(mocks.manageGroup).not.toHaveBeenCalled()
	})

	it('adds a duplicate to the filtered group', async () => {
		mocks.groups.mockResolvedValue([paletteGroup])
		render(
			<PaletteLibrary
				client={client}
				view="palettes"
				catalogStatus="assigned"
			/>,
		)
		await screen.findByRole('button', { name: 'Duplicate Cabo' })
		fireEvent.change(screen.getByLabelText('Show palettes'), {
			target: { value: 'set-one' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Duplicate Cabo' }))
		expect(
			screen.getByText('This palette will be added to "Warm colors".'),
		).toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: 'Cabo copy' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText(
			'Saved "Cabo copy" as a draft palette in "Warm colors".',
		)
		expect(mocks.manageGroup).toHaveBeenCalledWith(client, 'set-one', {
			kind: 'assign',
			paletteIds: [mocks.manage.mock.calls[0][1].id],
		})
	})

	it('leaves a duplicate unassigned when no group is filtered', async () => {
		mocks.groups.mockResolvedValue([paletteGroup])
		render(
			<PaletteLibrary
				client={client}
				view="palettes"
				catalogStatus="assigned"
			/>,
		)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Duplicate Cabo' }),
		)
		expect(
			screen.queryByText(/This palette will be added to/),
		).not.toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: 'Cabo copy' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText('Saved "Cabo copy" as a draft palette.')
		expect(mocks.manageGroup).not.toHaveBeenCalled()
	})

	it('cancels the editor back to the same filtered list, asking before discarding edits', async () => {
		mocks.groups.mockResolvedValue([paletteGroup])
		render(
			<PaletteLibrary
				client={client}
				view="palettes"
				catalogStatus="assigned"
			/>,
		)
		await screen.findByRole('button', { name: 'Edit Cabo' })
		fireEvent.change(screen.getByLabelText('Show palettes'), {
			target: { value: 'set-one' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'New palette' }))
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(screen.getByLabelText('Show palettes')).toHaveValue('set-one')
		fireEvent.click(screen.getByRole('button', { name: 'New palette' }))
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: 'Draft' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		expect(screen.getByLabelText('Show palettes')).toHaveValue('set-one')
		expect(mocks.manage).not.toHaveBeenCalled()
	})

	it('retries a failed group assignment with the same palette ID', async () => {
		mocks.groups.mockResolvedValue([paletteGroup])
		render(
			<PaletteLibrary
				client={client}
				view="palettes"
				catalogStatus="assigned"
			/>,
		)
		await screen.findByRole('button', { name: 'Edit Cabo' })
		fireEvent.change(screen.getByLabelText('Show palettes'), {
			target: { value: 'set-one' },
		})
		await clickWhenEnabled('New palette')
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: 'Ember' },
		})
		mocks.manageGroup.mockRejectedValueOnce(new Error('Assignment lost'))
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Assignment lost',
		)
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText(
			'Saved "Ember" as a draft palette in "Warm colors".',
		)
		expect(mocks.manage.mock.calls[1][1]).toEqual(
			mocks.manage.mock.calls[0][1],
		)
		expect(mocks.manageGroup).toHaveBeenCalledTimes(2)
	})

	it('bulk deletes only unassigned draft palettes and keeps failures visible', async () => {
		const loose = { ...samplePalette, id: 'loose', name: 'Loose' }
		mocks.load.mockResolvedValue([samplePalette, loose])
		mocks.groups.mockResolvedValue([paletteGroup])
		mocks.bulkDelete.mockRejectedValueOnce(new Error('Palette in use'))
		mocks.bulkDelete.mockResolvedValueOnce(undefined)
		setup()
		fireEvent.click(
			await screen.findByRole('checkbox', { name: 'Select all' }),
		)
		expect(
			screen.queryByRole('button', { name: 'Delete selected' }),
		).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select Cabo' }))
		fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }))
		const dialog = screen.getByRole('dialog', {
			name: 'Delete selected palettes',
		})
		expect(dialog).toHaveTextContent('Loose')
		expect(dialog).not.toHaveTextContent('Cabo')
		fireEvent.click(
			within(dialog).getByRole('button', { name: 'Delete palettes' }),
		)
		expect(await within(dialog).findByRole('alert')).toHaveTextContent(
			'Palette in use',
		)
		expect(
			screen.getByRole('checkbox', { name: 'Select Loose' }),
		).toBeChecked()
		mocks.load.mockResolvedValue([samplePalette])
		fireEvent.click(
			within(dialog).getByRole('button', { name: 'Delete palettes' }),
		)
		await screen.findByText('Deleted 1 palette.')
		expect(mocks.bulkDelete).toHaveBeenLastCalledWith(client, ['loose'])
		expect(mocks.bulkDelete).toHaveBeenCalledTimes(2)
	})

	it('offers deletion only for unassigned draft palettes', async () => {
		const loose = { ...samplePalette, id: 'loose', name: 'Loose' }
		mocks.load.mockResolvedValue([samplePalette, loose])
		mocks.groups.mockResolvedValue([paletteGroup])
		setup()
		fireEvent.click(
			await screen.findByRole('button', { name: 'Delete Loose' }),
		)
		expect(
			screen.queryByRole('button', { name: 'Delete Cabo' }),
		).not.toBeInTheDocument()
		expect(
			await screen.findByRole('button', {
				name: 'Confirm delete palette',
			}),
		).toBeEnabled()
		fireEvent.click(
			screen.getByRole('button', { name: 'Confirm delete palette' }),
		)
		await screen.findByText('Deleted "Loose".')
		expect(mocks.manage).toHaveBeenCalledWith(client, {
			kind: 'delete',
			previous: loose,
		})
	})

	it('creates Undecided groups over the list with retry-stable IDs and returns to Add, leaving editing separate', async () => {
		const { isProtected } = setup()
		await openGroups()
		await clickWhenEnabled('New palette group')
		expect(screen.getByLabelText('Purpose')).toHaveValue('undecided')
		fireEvent.change(screen.getByLabelText('Group name'), {
			target: { value: 'New colors' },
		})
		expect(isProtected()).toBe(true)
		expect(
			screen.getByRole('dialog', { name: 'New palette group' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('heading', { name: 'Palette groups' }),
		).toBeInTheDocument()
		expect(screen.getByLabelText('Group name')).toHaveValue('New colors')
		mocks.manageGroup.mockRejectedValueOnce(new Error('Lost response'))
		fireEvent.click(screen.getByRole('button', { name: 'Save group' }))
		await screen.findByText('Lost response')
		const args = mocks.manageGroup.mock.calls[0]
		expect(args).toEqual([
			client,
			expect.any(String),
			{ kind: 'create', name: 'New colors', purpose: 'undecided' },
		])
		mocks.groups.mockResolvedValue([
			{
				...paletteGroup,
				row: { ...paletteGroup.row, id: args[1], name: 'New colors' },
				members: [],
			},
		])
		fireEvent.click(screen.getByRole('button', { name: 'Save group' }))
		await screen.findByText('Palette group created.')
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'New palette group' }),
			).toBeEnabled(),
		)
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(mocks.manageGroup.mock.calls[1]).toEqual(args)
		await waitFor(() => expect(isProtected()).toBe(false))
		await clickWhenEnabled('New palette group')
		expect(screen.getByLabelText('Group name')).toHaveValue('')
		expect(screen.getByLabelText('Purpose')).toHaveValue('undecided')
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		fireEvent.click(
			screen.getByRole('button', { name: 'Edit group New colors' }),
		)
		fireEvent.change(screen.getByLabelText('Purpose'), {
			target: { value: 'reward' },
		})
		expect(isProtected()).toBe(true)
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText('Group saved.')
		expect(mocks.manageGroup).toHaveBeenLastCalledWith(client, args[1], {
			kind: 'update',
			name: 'New colors',
			purpose: 'reward',
		})
	})

	it('stages member order until Save, removes immediately, and deletes a group only after confirmation', async () => {
		const second = { ...samplePalette, id: 'other', name: 'Other colors' }
		mocks.groups.mockResolvedValue([
			{ ...paletteGroup, members: [samplePalette, second] },
		])
		const { isProtected } = setup()
		await openGroups()
		fireEvent.click(
			screen.getByRole('button', { name: 'Edit group Warm colors' }),
		)
		const saveOrder = screen.getByRole('button', { name: 'Save' })
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
		expect(mocks.manageGroup).not.toHaveBeenCalled()
		expect(isProtected()).toBe(true)
		fireEvent.click(saveOrder)
		await screen.findByText('Group saved.')
		expect(mocks.manageGroup).toHaveBeenCalledOnce()
		expect(mocks.manageGroup).toHaveBeenLastCalledWith(client, 'set-one', {
			kind: 'reorder',
			paletteIds: ['other', 'cabo'],
		})
		expect(mocks.groups).toHaveBeenCalledOnce()
		expect(isProtected()).toBe(false)
		expect(saveOrder).toBeDisabled()
		mocks.groups.mockResolvedValue([{ ...paletteGroup, members: [second] }])
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Remove Cabo from group' }),
			).toBeEnabled(),
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove Cabo from group' }),
		)
		await screen.findByText(/Palette removed/)
		expect(mocks.manageGroup).toHaveBeenLastCalledWith(client, 'set-one', {
			kind: 'remove',
			paletteIds: ['cabo'],
		})
		await waitFor(() => expect(isProtected()).toBe(false))
		fireEvent.click(screen.getByRole('button', { name: 'Groups' }))
		fireEvent.click(
			screen.getByRole('button', { name: 'Delete group Warm colors' }),
		)
		expect(
			screen.getByText(/palettes will remain in the library/),
		).toBeInTheDocument()
		expect(mocks.manageGroup).toHaveBeenCalledTimes(2)
		fireEvent.click(
			screen.getByRole('button', { name: 'Confirm delete group' }),
		)
		await screen.findByText(
			'Group deleted. Its palettes remain in the library.',
		)
		expect(mocks.manageGroup).toHaveBeenLastCalledWith(client, 'set-one', {
			kind: 'delete',
		})
		expect(mocks.manage).not.toHaveBeenCalled()
	})

	it('keeps prepared groups read-only and prevents selecting their members for moves', async () => {
		mocks.groups.mockResolvedValue([
			{
				...paletteGroup,
				row: {
					...paletteGroup.row,
					published_at: '2026-01-01',
					release_at: '2099-01-01',
				},
			},
		])
		setup()
		expect(
			await screen.findByRole('checkbox', { name: 'Select Cabo' }),
		).toBeDisabled()
		fireEvent.click(screen.getByRole('button', { name: 'Groups' }))
		expect(
			screen.getByRole('button', { name: 'Delete group Warm colors' }),
		).toBeDisabled()
		fireEvent.click(
			screen.getByRole('button', { name: 'Edit group Warm colors' }),
		)
		expect(screen.getByLabelText('Group name')).toBeDisabled()
		expect(screen.getByLabelText('Purpose')).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Remove Cabo from group' }),
		).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Reorder Cabo' }),
		).toBeDisabled()
		expect(
			screen.queryByRole('button', { name: 'Save' }),
		).not.toBeInTheDocument()
	})

	it('surfaces a group reload failure and supports retry without losing metadata edits', async () => {
		mocks.groups.mockResolvedValue([paletteGroup])
		setup()
		await openGroups()
		fireEvent.click(
			screen.getByRole('button', { name: 'Edit group Warm colors' }),
		)
		fireEvent.change(screen.getByLabelText('Group name'), {
			target: { value: 'Renamed colors' },
		})
		mocks.groups.mockRejectedValueOnce(new Error('Membership read failed'))
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText(/Membership read failed/)
		expect(screen.getByLabelText('Group name')).toHaveValue(
			'Renamed colors',
		)
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
		expect(mocks.manageGroup).toHaveBeenCalledTimes(1)
		fireEvent.click(
			screen.getByRole('button', { name: 'Retry loading groups' }),
		)
		await waitFor(() =>
			expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
		)
		expect(screen.getByLabelText('Group name')).toHaveValue(
			'Renamed colors',
		)
		fireEvent.change(screen.getByLabelText('Purpose'), {
			target: { value: 'pack' },
		})
		expect(screen.getByLabelText('Purpose')).toHaveValue('pack')
	})

	it.each([false, true])(
		'duplicates colors into an unnamed new draft without copying identity or release state (published: %s)',
		async published => {
			const source: CatalogPalette = {
				...samplePalette,
				id: 'source',
				name: 'Source',
				colors: ['#abcdef', '#123456', '#abcdef', '#fedcba', '#654321'],
				published_at: published ? '2000-01-01' : null,
				release_at: published ? '2000-01-01' : null,
			}
			mocks.load.mockResolvedValue([samplePalette, source])
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
			expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
			expect(mocks.usage).not.toHaveBeenCalled()
			expect(mocks.manage).not.toHaveBeenCalled()
			fireEvent.change(screen.getByLabelText('Palette name'), {
				target: { value: 'My variation' },
			})
			fireEvent.click(screen.getByRole('button', { name: 'Save' }))
			await screen.findByText('Saved "My variation" as a draft palette.')
			const request = mocks.manage.mock.calls[0][1]
			expect(request).toEqual({
				kind: 'create',
				id: expect.any(String),
				palette: { name: 'My variation', colors: source.colors },
			})
			expect(request.id).not.toBe(source.id)
		},
	)

	it('shows draft, scheduled, and live palettes and keeps prepared ones read-only', async () => {
		mocks.load.mockResolvedValue([
			samplePalette,
			{
				...samplePalette,
				id: 'scheduled',
				name: 'Scheduled art',
				published_at: '2026-01-01',
				release_at: '2099-01-01',
			},
			{
				...samplePalette,
				id: 'live',
				name: 'Live art',
				published_at: '2000-01-01',
				release_at: '2000-01-01',
			},
		])
		setup()
		expect(await screen.findByText(/^Scheduled for /)).toBeInTheDocument()
		expect(screen.getByText('Live')).toBeInTheDocument()
		expect(screen.queryByText('Draft')).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Delete Cabo' }),
		).toBeEnabled()
		expect(
			screen.queryByRole('button', { name: 'Delete Scheduled art' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Delete Live art' }),
		).not.toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('button', { name: 'View Scheduled art' }),
		)
		expect(screen.getByLabelText('Palette name')).toBeDisabled()
		expect(screen.getByLabelText('Color 1')).toBeDisabled()
		expect(
			screen.queryByRole('button', { name: 'Save' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Delete palette' }),
		).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Randomize' })).toBeEnabled()
		expect(mocks.manage).not.toHaveBeenCalled()
	})

	it('creates a palette with a retry-stable ID and reloads after a successful save', async () => {
		const { isProtected } = setup()
		await clickWhenEnabled('New palette')
		expect(
			screen.getByRole('img', { name: 'Palette sandbox design' }),
		).toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: ' New art ' },
		})
		expect(isProtected()).toBe(true)
		mocks.manage.mockRejectedValueOnce(new Error('Response lost'))
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Response lost',
		)
		expect(screen.getByLabelText('Palette name')).toHaveValue(' New art ')
		const firstRequest = mocks.manage.mock.calls[0][1]
		expect(firstRequest).toMatchObject({
			kind: 'create',
			palette: { name: 'New art', colors: samplePalette.colors },
		})
		expect(firstRequest.id).toMatch(/^[0-9a-f-]{36}$/)
		mocks.load.mockResolvedValue([
			samplePalette,
			{ ...samplePalette, id: firstRequest.id, name: 'New art' },
		])
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
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
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
		expect(
			screen.queryByRole('img', { name: 'Palette sandbox design' }),
		).not.toBeInTheDocument()
		fireEvent.change(first, { target: { value: samplePalette.colors[0] } })
		expect(sandboxFills()).toEqual(original)
		fireEvent.change(screen.getByLabelText('Pick color 1'), {
			target: { value: '#abcdef' },
		})
		expect(first).toHaveValue('#abcdef')
		expect(sandboxFills()).toEqual(
			original.map(color =>
				color === samplePalette.colors[0] ? '#abcdef' : color,
			),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByRole('heading', { name: 'Palettes' })
		expect(mocks.manage).toHaveBeenCalledWith(client, {
			kind: 'update',
			previous: samplePalette,
			palette: {
				name: 'Cabo',
				colors: ['#abcdef', ...samplePalette.colors.slice(1)],
			},
		})
	})

	it('preserves a conflicting edit and guards leaving through the Palettes tab and browser close', async () => {
		const { isProtected } = setup()
		await openEditor()
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: 'Revised' },
		})
		mocks.manage.mockRejectedValue(
			new Error('Refresh and review before retrying.'),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Refresh and review',
		)
		expect(screen.getByLabelText('Palette name')).toHaveValue('Revised')
		fireEvent.click(screen.getByRole('button', { name: 'Palette catalog' }))
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
			previous: samplePalette,
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
					context: 'Core · First group',
					preview: {
						shape: 'hexagon',
						gridSize: 3,
						target: { '0,0': 0 },
					},
				},
			],
			rewards: ['First group'],
			groups: ['Earth tones · Pack'],
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
		expect(screen.getByText('First group')).toBeInTheDocument()
		expect(screen.getByText('Earth tones · Pack')).toBeInTheDocument()
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
		await screen.findByText('Not used anywhere.')
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
		mocks.groups.mockResolvedValue([{ ...paletteGroup, members: [] }])
		let fail!: (cause: Error) => void
		mocks.manage.mockReturnValueOnce(
			new Promise((_resolve, reject) => {
				fail = reject
			}),
		)
		setup()
		await screen.findByRole('checkbox', { name: 'Select Cabo' })
		fireEvent.change(screen.getByLabelText('Show palettes'), {
			target: { value: 'ungrouped' },
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
		expect(screen.getByLabelText('Show palettes')).toHaveValue('ungrouped')
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

	it('keeps the editor free of deletion and shows only real usage references', async () => {
		setup()
		await openEditor()
		expect(
			screen.queryByRole('button', { name: 'Delete palette' }),
		).not.toBeInTheDocument()
		expect(screen.queryByText(/starter/)).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Refresh palette usage' }),
		).not.toBeInTheDocument()
		expect(screen.queryByText(/Palette ID/)).not.toBeInTheDocument()
		const save = screen.getByRole('button', { name: 'Save' })
		expect(save.parentElement?.parentElement).toContainElement(
			screen.getByLabelText('Palette name'),
		)
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
		let finish!: (palettes: readonly CatalogPalette[]) => void
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

describe('scheduled and published palette views', () => {
	const prepared = [
		samplePalette,
		{
			...samplePalette,
			id: 'scheduled',
			name: 'Scheduled art',
			published_at: '2026-01-01',
			release_at: '2099-01-01',
		},
		{
			...samplePalette,
			id: 'live',
			name: 'Live art',
			published_at: '2000-01-01',
			release_at: '2000-01-01',
		},
	]

	it('lists only scheduled palettes, with no release buttons, creation, or selection', async () => {
		mocks.load.mockResolvedValue(prepared)
		render(<PaletteLibrary client={client} catalogStatus="scheduled" />)
		expect(
			await screen.findByRole('heading', { name: 'Scheduled palettes' }),
		).toBeInTheDocument()
		expect(screen.getByText('Scheduled art')).toBeInTheDocument()
		expect(screen.queryByText('Live art')).not.toBeInTheDocument()
		expect(screen.queryByText('Cabo')).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: /^(Re|Un)?[Ss]chedule / }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'New palette' }),
		).not.toBeInTheDocument()
		expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
	})

	it('lists only live palettes with nothing to schedule or cancel', async () => {
		mocks.load.mockResolvedValue(prepared)
		render(<PaletteLibrary client={client} catalogStatus="published" />)
		expect(
			await screen.findByRole('heading', { name: 'Published palettes' }),
		).toBeInTheDocument()
		expect(screen.getByText('Live art')).toBeInTheDocument()
		expect(screen.queryByText('Scheduled art')).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: /Unschedule palette/ }),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'View Live art' }),
		).toBeInTheDocument()
	})
})
