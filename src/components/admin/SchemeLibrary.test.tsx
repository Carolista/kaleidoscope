import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '../../types/database'
import type { CatalogScheme } from '../../services/colorSchemes'
import type { SchemeUsage } from '../../services/schemeUsage'
import SchemeLibrary from './SchemeLibrary'

const mocks = vi.hoisted(() => ({
	load: vi.fn(),
	manage: vi.fn(),
	usage: vi.fn(),
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
beforeEach(() => {
	vi.resetAllMocks()
	mocks.load.mockResolvedValue([scheme])
	mocks.manage.mockResolvedValue(undefined)
	mocks.usage.mockResolvedValue(emptyUsage)
})
afterEach(() => vi.restoreAllMocks())

async function openEditor() {
	fireEvent.click(await screen.findByRole('button', { name: 'Edit Cabo' }))
	await screen.findByText(/No saved references/)
}
function setup() {
	const onBack = vi.fn()
	const onDirtyChange = vi.fn()
	return {
		...render(
			<SchemeLibrary
				client={client}
				onBack={onBack}
				onDirtyChange={onDirtyChange}
			/>,
		),
		onBack,
		onDirtyChange,
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
		const { onDirtyChange } = setup()
		fireEvent.click(
			await screen.findByRole('button', { name: 'New palette' }),
		)
		expect(
			screen.getByRole('img', { name: 'Palette sandbox design' }),
		).toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Palette name'), {
			target: { value: ' New art ' },
		})
		expect(onDirtyChange).toHaveBeenLastCalledWith(true)
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
		expect(onDirtyChange).toHaveBeenLastCalledWith(false)
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
		const { onDirtyChange } = setup()
		await openEditor()
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
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
		expect(confirm).toHaveBeenCalledWith('Discard unsaved admin changes?')
		expect(screen.getByLabelText('Palette name')).toHaveValue('Revised')
		const event = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(event)
		expect(event.defaultPrevented).toBe(true)
		confirm.mockReturnValue(true)
		fireEvent.click(
			screen.getByRole('button', { name: 'Back to palettes' }),
		)
		expect(
			screen.getByRole('heading', { name: 'Palettes' }),
		).toBeInTheDocument()
		expect(onDirtyChange).toHaveBeenLastCalledWith(false)
	})

	it('loads usage before confirming named deletion and reloads after success', async () => {
		setup()
		fireEvent.click(
			await screen.findByRole('button', { name: 'Delete Cabo' }),
		)
		const confirm = await screen.findByRole('group', {
			name: 'Confirm palette deletion',
		})
		expect(
			within(confirm).getByText(/Delete "Cabo" permanently/),
		).toBeInTheDocument()
		expect(mocks.manage).not.toHaveBeenCalled()
		fireEvent.click(
			within(confirm).getByRole('button', { name: 'Cancel deletion' }),
		)
		expect(
			screen.queryByRole('group', { name: 'Confirm palette deletion' }),
		).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Delete palette' }))
		mocks.load.mockResolvedValue([])
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
		fireEvent.change(screen.getByLabelText('Color 1'), {
			target: { value: '#abcdef' },
		})
		expect(preview.querySelector('polygon[fill="#abcdef"]')).not.toBeNull()
		expect(
			screen.getByRole('button', { name: 'Delete palette' }),
		).toBeDisabled()
		expect(
			screen.queryByRole('button', { name: 'Confirm delete palette' }),
		).not.toBeInTheDocument()
	})

	it('blocks deletion on failed usage reads and supports an explicit retry', async () => {
		mocks.usage.mockRejectedValueOnce(new Error('Offline'))
		setup()
		fireEvent.click(
			await screen.findByRole('button', { name: 'Delete Cabo' }),
		)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Deletion is disabled',
		)
		expect(
			screen.getByRole('button', { name: 'Delete palette' }),
		).toBeDisabled()
		fireEvent.click(
			screen.getByRole('button', { name: 'Refresh palette usage' }),
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
		expect(screen.getByLabelText('Palette name')).toHaveValue('Cabo')
	})

	it('reports catalog load failures and retries instead of showing an empty success', async () => {
		mocks.load.mockRejectedValueOnce(new Error('Catalog offline'))
		const { onBack } = setup()
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
		fireEvent.click(screen.getByRole('button', { name: 'Back to puzzles' }))
		expect(onBack).toHaveBeenCalledOnce()
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
		expect(
			screen.getByRole('button', { name: 'Back to palettes' }),
		).toBeDisabled()
		finish()
		await waitFor(() =>
			expect(
				screen.getByRole('heading', { name: 'Palettes' }),
			).toBeInTheDocument(),
		)
	})
})
