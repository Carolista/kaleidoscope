import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseClient } from '@/lib/supabase'
import type { DraftSet } from '@/features/admin/services'
import PuzzleSetLibrary from './PuzzleSetLibrary'
import {
	generateAuthoredHexPuzzle,
	renderAuthoredHexPuzzle,
	PUZZLE_RECIPES,
} from '@/domain/puzzles'
import styles from './PuzzleSetLibrary.module.css'
import toneStyles from '@/features/admin/common/AdminIconButton.module.css'
import layoutStyles from '@/features/admin/common/AdminLayout.module.css'
import { useState } from 'react'
import { useNavigationGuard } from '@/ui/navigation'
import iconStyles from '@/ui/components/IconButton.module.css'

const mocks = vi.hoisted(() => ({
	load: vi.fn(),
	manage: vi.fn(),
	remove: vi.fn(),
}))
vi.mock('@/features/admin/services/puzzleSets', () => ({
	loadDraftSets: (...args: unknown[]) => mocks.load(...args),
	manageDraftSet: (...args: unknown[]) => mocks.manage(...args),
	deleteDraftSet: (...args: unknown[]) => mocks.remove(...args),
}))
vi.mock('@/lib/supabase/supabaseClient', () => ({
	getSupabaseClient: () => ({}),
}))
const draftSet: DraftSet = {
	preview: null,
	row: {
		id: 'set',
		name: 'First set',
		kind: 'core',
		shape_id: 'hexagon',
		selection_mode: 'any',
		published_at: null,
		release_at: null,
	},
	members: [
		{ puzzleId: 'a', name: 'Puzzle A', position: 1, preview: null },
		{ puzzleId: 'b', name: 'Puzzle B', position: 2, preview: null },
	],
}
beforeEach(() => {
	vi.resetAllMocks()
	mocks.load.mockResolvedValue([draftSet])
	mocks.manage.mockResolvedValue(undefined)
	mocks.remove.mockResolvedValue(undefined)
})
afterEach(() => vi.restoreAllMocks())
// Mirrors AdminWorkspace: reselecting the Sets tab remounts the library.
function Harness() {
	const { requestNavigation } = useNavigationGuard()
	const [visit, setVisit] = useState(0)
	return (
		<>
			<button
				onClick={() => requestNavigation(() => setVisit(n => n + 1))}
			>
				Sets tab
			</button>
			<PuzzleSetLibrary key={visit} client={getSupabaseClient()} />
		</>
	)
}
function setup() {
	render(<Harness />)
}
function isProtected() {
	const event = new Event('beforeunload', { cancelable: true })
	window.dispatchEvent(event)
	return event.defaultPrevented
}
async function open() {
	fireEvent.click(
		await screen.findByRole('button', { name: 'Edit set First set' }),
	)
}
describe('draft set workspace', () => {
	it.each(['mouse', 'touch'])(
		'drags cards with %s input without requests, and restores the order on cancellation',
		async pointerType => {
			setup()
			await open()
			const handle = screen.getByRole('button', {
				name: 'Reorder Puzzle A',
			})
			const rowB = screen.getByText('2. Puzzle B').closest('li')!
			const list = screen.getByText(/Drag the handles/).parentElement!
			const capture = vi.fn()
			const release = vi.fn()
			Object.defineProperty(list, 'setPointerCapture', { value: capture })
			Object.defineProperty(list, 'releasePointerCapture', {
				value: release,
			})
			const originalHitTest = Object.getOwnPropertyDescriptor(
				document,
				'elementFromPoint',
			)
			Object.defineProperty(document, 'elementFromPoint', {
				configurable: true,
				value: vi.fn(() => rowB),
			})
			function pointer(target: Element, type: string) {
				const event = new MouseEvent(type, {
					bubbles: true,
					button: 0,
					clientX: 10,
					clientY: 20,
				})
				Object.defineProperties(event, {
					pointerId: { value: 1 },
					isPrimary: { value: true },
					pointerType: { value: pointerType },
				})
				fireEvent(target, event)
			}
			try {
				pointer(handle, 'pointerdown')
				expect(capture).toHaveBeenCalledWith(1)
				expect(handle).toHaveFocus()
				pointer(list, 'pointermove')
				expect(screen.getByText('1. Puzzle B')).toBeInTheDocument()
				pointer(list, 'pointercancel')
				expect(screen.getByText('1. Puzzle A')).toBeInTheDocument()
				expect(
					screen.getByRole('button', { name: 'Save' }),
				).toBeDisabled()
				pointer(handle, 'pointerdown')
				pointer(list, 'pointermove')
				pointer(list, 'pointerup')
				expect(release).toHaveBeenCalledWith(1)
				expect(screen.getByText('1. Puzzle B')).toBeInTheDocument()
				expect(
					screen.getByRole('button', { name: 'Save' }),
				).toBeEnabled()
				expect(mocks.manage).not.toHaveBeenCalled()
				expect(mocks.load).toHaveBeenCalledOnce()
			} finally {
				if (originalHitTest)
					Object.defineProperty(
						document,
						'elementFromPoint',
						originalHitTest,
					)
				else Reflect.deleteProperty(document, 'elementFromPoint')
			}
		},
	)

	it('allows repeated keyboard moves, preserves a failed order save for retry, and clears the dirty guard after success', async () => {
		const third = {
			puzzleId: 'c',
			name: 'Puzzle C',
			position: 3,
			preview: null,
		}
		mocks.load.mockResolvedValue([
			{ ...draftSet, members: [...draftSet.members, third] },
		])
		setup()
		await open()
		const handle = screen.getByRole('button', { name: 'Reorder Puzzle A' })
		handle.focus()
		fireEvent.keyDown(handle, { key: 'ArrowDown' })
		fireEvent.keyDown(handle, { key: 'ArrowDown' })
		expect(screen.getByText('3. Puzzle A')).toBeInTheDocument()
		expect(handle).toHaveFocus()
		expect(mocks.manage).not.toHaveBeenCalled()
		fireEvent.keyDown(handle, { key: 'Home' })
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
		fireEvent.keyDown(handle, { key: 'End' })
		const unload = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(unload)
		expect(unload.defaultPrevented).toBe(true)
		mocks.manage.mockRejectedValueOnce(new Error('Order save failed'))
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Order save failed',
		)
		expect(screen.getByText('3. Puzzle A')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
		mocks.load.mockResolvedValue([
			{
				...draftSet,
				members: [draftSet.members[1], third, draftSet.members[0]],
			},
		])
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText('Set saved.')
		expect(mocks.manage).toHaveBeenLastCalledWith(
			expect.anything(),
			'set',
			{
				kind: 'reorder',
				puzzleIds: ['b', 'c', 'a'],
			},
		)
		expect(mocks.manage.mock.calls[0]).toEqual(mocks.manage.mock.calls[1])
		await screen.findByText('3. Puzzle A')
		const cleanUnload = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(cleanUnload)
		expect(cleanUnload.defaultPrevented).toBe(false)
	})

	it('discards a staged order without writing and reopens the saved order', async () => {
		setup()
		await open()
		fireEvent.keyDown(
			screen.getByRole('button', { name: 'Reorder Puzzle A' }),
			{ key: 'End' },
		)
		fireEvent.click(screen.getByRole('button', { name: 'Sets tab' }))
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		await open()
		expect(screen.getByText('1. Puzzle A')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
		expect(mocks.manage).not.toHaveBeenCalled()
	})

	it('preserves staged ordering and name across immediate removal, then saves both together', async () => {
		const third = {
			puzzleId: 'c',
			name: 'Puzzle C',
			position: 3,
			preview: null,
		}
		mocks.load.mockResolvedValue([
			{ ...draftSet, members: [...draftSet.members, third] },
		])
		setup()
		await open()
		fireEvent.change(screen.getByLabelText('Set name'), {
			target: { value: 'Renamed set' },
		})
		fireEvent.keyDown(
			screen.getByRole('button', { name: 'Reorder Puzzle A' }),
			{ key: 'End' },
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove Puzzle B from set' }),
		)
		await screen.findByText('Puzzle removed from set.')
		await screen.findByText('1. Puzzle C')
		expect(screen.getByLabelText('Set name')).toHaveValue('Renamed set')
		expect(mocks.manage).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			'set',
			{
				kind: 'remove',
				puzzleIds: ['b'],
			},
		)
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText('Set saved.')
		expect(mocks.manage.mock.calls.slice(1)).toEqual([
			[expect.anything(), 'set', { kind: 'rename', name: 'Renamed set' }],
			[
				expect.anything(),
				'set',
				{ kind: 'reorder', puzzleIds: ['c', 'a'] },
			],
		])
		expect(mocks.load).toHaveBeenCalledOnce()
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
		expect(mocks.remove).not.toHaveBeenCalled()
	})

	it('shows each member design beside its name and keeps thumbnails attached to puzzles after reordering', async () => {
		const palette = {
			id: 'cabo',
			name: 'Cabo',
			colors: [
				'#112233',
				'#223344',
				'#334455',
				'#445566',
				'#556677',
			] as const,
		}
		const members = draftSet.members.map((member, index) => ({
			...member,
			preview: renderAuthoredHexPuzzle(
				generateAuthoredHexPuzzle(
					`member-${index}`,
					palette.id,
					PUZZLE_RECIPES[index],
				),
				palette,
			),
		}))
		mocks.load.mockResolvedValue([{ ...draftSet, members }])
		setup()
		await open()
		const firstRow = screen.getByText('1. Puzzle A').closest('li')!
		const secondRow = screen.getByText('2. Puzzle B').closest('li')!
		expect(
			firstRow.querySelector(`.${styles.setMemberThumbnail} svg`),
		).toBeInTheDocument()
		expect(
			secondRow.querySelector(`.${styles.setMemberThumbnail} svg`),
		).toBeInTheDocument()
		expect(
			within(firstRow)
				.getByRole('button', { name: 'Remove Puzzle A from set' })
				.querySelector('svg'),
		).toHaveAttribute('data-icon', 'square-minus')
		const firstDesign = firstRow.querySelector(
			`.${styles.setMemberThumbnail}`,
		)?.innerHTML
		const secondDesign = secondRow.querySelector(
			`.${styles.setMemberThumbnail}`,
		)?.innerHTML
		expect(firstDesign).not.toEqual(secondDesign)
		mocks.load.mockResolvedValue([
			{
				...draftSet,
				members: [
					{ ...members[1], position: 1 },
					{ ...members[0], position: 2 },
				],
			},
		])
		fireEvent.keyDown(
			within(firstRow).getByRole('button', {
				name: 'Reorder Puzzle A',
			}),
			{ key: 'ArrowDown' },
		)
		expect(mocks.manage).not.toHaveBeenCalled()
		expect(mocks.load).toHaveBeenCalledOnce()
		await screen.findByText('1. Puzzle B')
		expect(
			screen
				.getByText('1. Puzzle B')
				.closest('li')
				?.querySelector(`.${styles.setMemberThumbnail}`)?.innerHTML,
		).toEqual(secondDesign)
		expect(
			screen
				.getByText('2. Puzzle A')
				.closest('li')
				?.querySelector(`.${styles.setMemberThumbnail}`)?.innerHTML,
		).toEqual(firstDesign)
	})
	it('shows a non-navigating landscape card with a stored thumbnail, role, count and colored square actions', async () => {
		const palette = {
			id: 'cabo',
			name: 'Cabo',
			colors: [
				'#112233',
				'#223344',
				'#334455',
				'#445566',
				'#556677',
			] as const,
		}
		mocks.load.mockResolvedValue([
			{
				...draftSet,
				preview: renderAuthoredHexPuzzle(
					generateAuthoredHexPuzzle(
						'preview',
						palette.id,
						PUZZLE_RECIPES[0],
					),
					palette,
				),
			},
		])
		setup()
		const card = await screen.findByRole('listitem', {
			name: 'Set First set',
		})
		expect(card).toHaveClass(layoutStyles.setCard)
		expect(within(card).getByText('Core')).toBeInTheDocument()
		expect(within(card).getByText('2 puzzles')).toBeInTheDocument()
		expect(
			card.querySelector('svg polygon[fill="#112233"]'),
		).toBeInTheDocument()
		expect(
			within(card).getByRole('button', { name: 'Edit set First set' }),
		).toHaveClass(iconStyles.button, toneStyles.edit)
		expect(
			within(card).getByRole('button', { name: 'Delete set First set' }),
		).toHaveClass(iconStyles.button, toneStyles.delete)
		fireEvent.click(within(card).getByText('First set'))
		expect(
			screen.getByRole('heading', { name: 'Draft sets' }),
		).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'New set' })).toHaveAttribute(
			'title',
			'New set',
		)
	})
	it.each([
		['reward', 'Reward'],
		['paid', 'Pack'],
	] as const)(
		'labels %s sets and explicitly shows empty sets',
		async (kind, label) => {
			mocks.load.mockResolvedValue([
				{ ...draftSet, row: { ...draftSet.row, kind }, members: [] },
			])
			setup()
			await screen.findByText(label)
			expect(screen.getByText('0 puzzles')).toBeInTheDocument()
			expect(screen.getByText('Empty set')).toBeInTheDocument()
		},
	)
	it('confirms deletion, allows cancellation, and retains confirmation after failure for retry', async () => {
		setup()
		fireEvent.click(
			await screen.findByRole('button', { name: 'Delete set First set' }),
		)
		expect(
			screen.getByText(/2 puzzles will be unassigned, not deleted/),
		).toBeInTheDocument()
		expect(mocks.remove).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: 'Keep set' }))
		expect(
			screen.queryByRole('dialog', { name: 'Confirm set deletion' }),
		).not.toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('button', { name: 'Delete set First set' }),
		)
		mocks.remove.mockRejectedValueOnce(
			new Error('Remove reward dependencies'),
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Confirm delete set' }),
		)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Remove reward dependencies',
		)
		expect(
			screen.getByRole('dialog', { name: 'Confirm set deletion' }),
		).toBeInTheDocument()
		mocks.load.mockResolvedValue([])
		fireEvent.click(
			screen.getByRole('button', { name: 'Confirm delete set' }),
		)
		await screen.findByText('No draft sets yet.')
		expect(screen.queryByRole('list')).not.toBeInTheDocument()
		expect(screen.getByRole('status')).toHaveTextContent(
			'Its puzzles remain in the library',
		)
		expect(mocks.remove).toHaveBeenLastCalledWith(expect.anything(), 'set')
		expect(mocks.manage).not.toHaveBeenCalled()
	})
	it('prevents duplicate deletion and navigation while deletion is in flight', async () => {
		let finish: (() => void) | undefined
		mocks.remove.mockReturnValueOnce(
			new Promise<void>(resolve => {
				finish = resolve
			}),
		)
		setup()
		fireEvent.click(
			await screen.findByRole('button', { name: 'Delete set First set' }),
		)
		const confirm = screen.getByRole('button', {
			name: 'Confirm delete set',
		})
		fireEvent.click(confirm)
		fireEvent.click(confirm)
		expect(mocks.remove).toHaveBeenCalledOnce()
		expect(screen.getByRole('status')).toHaveTextContent(
			'Deleting puzzle set…',
		)
		expect(screen.getByRole('status').querySelector('img')).toHaveAttribute(
			'aria-hidden',
			'true',
		)
		expect(isProtected()).toBe(true)
		expect(screen.getByRole('button', { name: 'Keep set' })).toBeDisabled()
		mocks.load.mockResolvedValue([])
		finish?.()
		await screen.findByText('No draft sets yet.')
	})
	it('creates a named set with a chosen role and no fixed puzzle count, retaining retry identity', async () => {
		setup()
		await screen.findByRole('button', { name: 'Edit set First set' })
		fireEvent.click(screen.getByRole('button', { name: 'New set' }))
		expect(
			screen.getByRole('dialog', { name: 'New set' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Edit set First set' }),
		).toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Set name'), {
			target: { value: 'New collection' },
		})
		fireEvent.change(screen.getByLabelText('Set role'), {
			target: { value: 'paid' },
		})
		mocks.manage.mockRejectedValueOnce(new Error('Connection lost'))
		fireEvent.click(screen.getByRole('button', { name: 'Create set' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Connection lost',
		)
		expect(screen.getByLabelText('Set name')).toHaveValue('New collection')
		const id = mocks.manage.mock.calls[0][1]
		mocks.load.mockResolvedValue([
			{
				...draftSet,
				row: {
					...draftSet.row,
					id,
					name: 'New collection',
					kind: 'paid',
				},
				members: [],
			},
		])
		fireEvent.click(screen.getByRole('button', { name: 'Create set' }))
		await screen.findByRole('button', { name: 'Edit set New collection' })
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'New set' })).toBeEnabled()
		expect(mocks.manage.mock.calls[1]).toEqual(mocks.manage.mock.calls[0])
		expect(mocks.manage).toHaveBeenLastCalledWith(expect.anything(), id, {
			kind: 'create',
			name: 'New collection',
			role: 'paid',
		})
		fireEvent.click(screen.getByRole('button', { name: 'New set' }))
		expect(screen.getByLabelText('Set name')).toHaveValue('')
		expect(screen.getByLabelText('Set role')).toHaveValue('core')
	})
	it('guards unsaved names, renames the set and keeps its role unchanged', async () => {
		setup()
		await open()
		fireEvent.change(screen.getByLabelText('Set name'), {
			target: { value: 'Revised' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Sets tab' }))
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		expect(screen.getByLabelText('Set name')).toHaveValue('Revised')
		mocks.load.mockResolvedValue([
			{ ...draftSet, row: { ...draftSet.row, name: 'Revised' } },
		])
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText('Set saved.')
		await waitFor(() =>
			expect(
				screen.queryByText('Loading draft sets...'),
			).not.toBeInTheDocument(),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Sets tab' }))
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(mocks.manage).toHaveBeenCalledWith(expect.anything(), 'set', {
			kind: 'rename',
			name: 'Revised',
		})
	})
	it('stages order changes, saves once, prevents duplicates in flight, and still removes immediately', async () => {
		setup()
		await open()
		const handle = screen.getByRole('button', { name: 'Reorder Puzzle A' })
		const saveOrder = screen.getByRole('button', { name: 'Save' })
		expect(saveOrder).toBeDisabled()
		fireEvent.keyDown(handle, { key: 'ArrowUp' })
		expect(saveOrder).toBeDisabled()
		fireEvent.keyDown(handle, { key: 'ArrowDown' })
		expect(screen.getByText('1. Puzzle B')).toBeInTheDocument()
		expect(mocks.manage).not.toHaveBeenCalled()
		expect(mocks.load).toHaveBeenCalledOnce()
		fireEvent.click(screen.getByRole('button', { name: 'Sets tab' }))
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		mocks.load.mockResolvedValue([
			{
				...draftSet,
				members: [...draftSet.members].reverse(),
			},
		])
		let finish: (() => void) | undefined
		mocks.manage.mockReturnValueOnce(
			new Promise<void>(resolve => {
				finish = resolve
			}),
		)
		fireEvent.click(saveOrder)
		fireEvent.click(saveOrder)
		expect(mocks.manage).toHaveBeenCalledOnce()
		expect(mocks.manage).toHaveBeenCalledWith(expect.anything(), 'set', {
			kind: 'reorder',
			puzzleIds: ['b', 'a'],
		})
		expect(isProtected()).toBe(true)
		finish?.()
		await screen.findByText('Set saved.')
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(),
		)
		const remove = await screen.findByRole('button', {
			name: 'Remove Puzzle A from set',
		})
		fireEvent.click(remove)
		await screen.findByText('Puzzle removed from set.')
		expect(mocks.manage).toHaveBeenLastCalledWith(
			expect.anything(),
			'set',
			{ kind: 'remove', puzzleIds: ['a'] },
		)
	})
	it('surfaces membership mutation errors without losing members and can retry', async () => {
		setup()
		await open()
		mocks.manage.mockRejectedValueOnce(
			new Error('Remove qualifying routes first'),
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove Puzzle A from set' }),
		)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Remove qualifying routes first',
		)
		expect(screen.getByText('1. Puzzle A')).toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove Puzzle A from set' }),
		)
		await screen.findByText('Puzzle removed from set.')
	})
	it('shows load errors and refreshes instead of reporting an empty catalog', async () => {
		mocks.load.mockRejectedValueOnce(new Error('Offline'))
		setup()
		expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
		expect(screen.queryByText('No draft sets yet.')).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Refresh sets' }))
		await screen.findByRole('button', { name: 'Edit set First set' })
	})
	it('saves the name and order together without reloading the catalog', async () => {
		setup()
		await open()
		fireEvent.change(screen.getByLabelText('Set name'), {
			target: { value: 'Revised' },
		})
		fireEvent.keyDown(
			screen.getByRole('button', { name: 'Reorder Puzzle A' }),
			{ key: 'ArrowDown' },
		)
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText('Set saved.')
		expect(screen.getByText('1. Puzzle B')).toBeInTheDocument()
		expect(screen.getByLabelText('Set name')).toHaveValue('Revised')
		expect(mocks.load).toHaveBeenCalledOnce()
		expect(isProtected()).toBe(false)
		fireEvent.click(screen.getByRole('button', { name: 'Sets tab' }))
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(
			await screen.findByRole('button', { name: 'Edit set Revised' }),
		).toBeInTheDocument()
	})
})
