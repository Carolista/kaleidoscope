import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseClient } from '@/lib/supabase'
import type { PuzzleGroup } from '@/features/admin/services'
import PuzzleGroupLibrary from './PuzzleGroupLibrary'
import {
	generateAuthoredPuzzle,
	renderAuthoredPuzzle,
	PUZZLE_RECIPES,
} from '@/domain/puzzles'
import styles from './PuzzleGroupLibrary.module.css'
import toneStyles from '@/features/admin/common/AdminIconButton.module.css'
import layoutStyles from '@/features/admin/common/AdminLayout.module.css'
import { useState } from 'react'
import { useNavigationGuard } from '@/ui/navigation'
import iconStyles from '@/ui/components/IconButton.module.css'

const mocks = vi.hoisted(() => ({
	load: vi.fn(),
	manage: vi.fn(),
	preview: vi.fn(),
	apply: vi.fn(),
}))
vi.mock('@/features/admin/services/release', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/release')
	>()),
	previewRelease: (...args: unknown[]) => mocks.preview(...args),
	applyRelease: (...args: unknown[]) => mocks.apply(...args),
}))
vi.mock('@/features/admin/services/puzzleGroups', () => ({
	loadPuzzleGroups: (...args: unknown[]) => mocks.load(...args),
	managePuzzleGroup: (...args: unknown[]) => mocks.manage(...args),
}))
vi.mock('@/lib/supabase/supabaseClient', () => ({
	getSupabaseClient: () => ({}),
}))
const draftGroup: PuzzleGroup = {
	preview: null,
	row: {
		id: 'group',
		name: 'First group',
		purpose: 'core',
		track: 'basic',
		shape_id: 'hexagon',
		selection_mode: 'any',
		published_at: null,
		release_at: null,
	},
	purpose: 'core',
	track: 'basic',
	members: [
		{ puzzleId: 'a', name: 'Puzzle A', position: 1, preview: null },
		{ puzzleId: 'b', name: 'Puzzle B', position: 2, preview: null },
	],
}
beforeEach(() => {
	vi.resetAllMocks()
	mocks.load.mockResolvedValue([draftGroup])
	mocks.manage.mockResolvedValue(undefined)
})
afterEach(() => vi.restoreAllMocks())
// Mirrors AdminWorkspace: reselecting the Groups tab remounts the library.
function Harness() {
	const { requestNavigation } = useNavigationGuard()
	const [visit, setVisit] = useState(0)
	return (
		<>
			<button
				onClick={() => requestNavigation(() => setVisit(n => n + 1))}
			>
				Groups tab
			</button>
			<PuzzleGroupLibrary key={visit} client={getSupabaseClient()} />
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
		await screen.findByRole('button', { name: 'Edit group First group' }),
	)
}
describe('puzzle group workspace', () => {
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
			{ ...draftGroup, members: [...draftGroup.members, third] },
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
				...draftGroup,
				members: [draftGroup.members[1], third, draftGroup.members[0]],
			},
		])
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText('Group saved.')
		expect(mocks.manage).toHaveBeenLastCalledWith(
			expect.anything(),
			'group',
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
		fireEvent.click(screen.getByRole('button', { name: 'Groups tab' }))
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
			{ ...draftGroup, members: [...draftGroup.members, third] },
		])
		setup()
		await open()
		fireEvent.change(screen.getByLabelText('Group name'), {
			target: { value: 'Renamed group' },
		})
		fireEvent.keyDown(
			screen.getByRole('button', { name: 'Reorder Puzzle A' }),
			{ key: 'End' },
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove Puzzle B from group' }),
		)
		await screen.findByText('Puzzle removed from group.')
		await screen.findByText('1. Puzzle C')
		expect(screen.getByLabelText('Group name')).toHaveValue('Renamed group')
		expect(mocks.manage).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			'group',
			{
				kind: 'remove',
				puzzleIds: ['b'],
			},
		)
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText('Group saved.')
		expect(mocks.manage.mock.calls.slice(1)).toEqual([
			[
				expect.anything(),
				'group',
				{
					kind: 'update',
					name: 'Renamed group',
					details: {
						purpose: 'core',
						shape: 'hexagon',
						track: 'basic',
					},
				},
			],
			[
				expect.anything(),
				'group',
				{ kind: 'reorder', puzzleIds: ['c', 'a'] },
			],
		])
		expect(mocks.load).toHaveBeenCalledOnce()
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
		expect(mocks.manage).not.toHaveBeenCalledWith(
			expect.anything(),
			'group',
			{ kind: 'delete' },
		)
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
		const members = draftGroup.members.map((member, index) => ({
			...member,
			preview: renderAuthoredPuzzle(
				generateAuthoredPuzzle(
					`member-${index}`,
					palette.id,
					PUZZLE_RECIPES[index],
					'hexagon',
				),
				palette,
			),
		}))
		mocks.load.mockResolvedValue([{ ...draftGroup, members }])
		setup()
		await open()
		const firstRow = screen.getByText('1. Puzzle A').closest('li')!
		const secondRow = screen.getByText('2. Puzzle B').closest('li')!
		expect(
			firstRow.querySelector(`.${styles.groupMemberThumbnail} svg`),
		).toBeInTheDocument()
		expect(
			secondRow.querySelector(`.${styles.groupMemberThumbnail} svg`),
		).toBeInTheDocument()
		expect(
			within(firstRow)
				.getByRole('button', { name: 'Remove Puzzle A from group' })
				.querySelector('svg'),
		).toHaveAttribute('data-icon', 'square-minus')
		const firstDesign = firstRow.querySelector(
			`.${styles.groupMemberThumbnail}`,
		)?.innerHTML
		const secondDesign = secondRow.querySelector(
			`.${styles.groupMemberThumbnail}`,
		)?.innerHTML
		expect(firstDesign).not.toEqual(secondDesign)
		mocks.load.mockResolvedValue([
			{
				...draftGroup,
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
				?.querySelector(`.${styles.groupMemberThumbnail}`)?.innerHTML,
		).toEqual(secondDesign)
		expect(
			screen
				.getByText('2. Puzzle A')
				.closest('li')
				?.querySelector(`.${styles.groupMemberThumbnail}`)?.innerHTML,
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
				...draftGroup,
				preview: renderAuthoredPuzzle(
					generateAuthoredPuzzle(
						'preview',
						palette.id,
						PUZZLE_RECIPES[0],
						'hexagon',
					),
					palette,
				),
			},
		])
		setup()
		const card = await screen.findByRole('listitem', {
			name: 'Group First group',
		})
		expect(card).toHaveClass(layoutStyles.groupCard)
		expect(
			within(card).getByText('Core · Hexagon · Basic'),
		).toBeInTheDocument()
		expect(within(card).getByText('2 puzzles')).toBeInTheDocument()
		expect(
			card.querySelector('svg polygon[fill="#112233"]'),
		).toBeInTheDocument()
		expect(
			within(card).getByRole('button', {
				name: 'Edit group First group',
			}),
		).toHaveClass(iconStyles.button, toneStyles.edit)
		expect(
			within(card).getByRole('button', {
				name: 'Delete group First group',
			}),
		).toHaveClass(iconStyles.button, toneStyles.delete)
		fireEvent.click(within(card).getByText('First group'))
		expect(
			screen.getByRole('heading', { name: 'Puzzle groups' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'New group' }),
		).toHaveAttribute('title', 'New group')
	})
	it.each([
		['reward', 'rotation', 'Reward · Hexagon · Rotation'],
		['pack', 'mixed', 'Pack · Hexagon · Mixed'],
	] as const)(
		'labels %s groups and explicitly shows empty groups',
		async (purpose, track, label) => {
			mocks.load.mockResolvedValue([
				{
					...draftGroup,
					purpose,
					track,
					row: { ...draftGroup.row, purpose, track },
					members: [],
				},
			])
			setup()
			await screen.findByText(label)
			expect(screen.getByText('0 puzzles')).toBeInTheDocument()
			expect(screen.getByText('Empty group')).toBeInTheDocument()
		},
	)
	it('labels daily groups as mixing every shape, with no track', async () => {
		mocks.load.mockResolvedValue([
			{
				...draftGroup,
				purpose: 'daily',
				track: null,
				row: {
					...draftGroup.row,
					purpose: 'daily',
					track: null,
					shape_id: null,
				},
			},
		])
		setup()
		await screen.findByText('Daily · All shapes')
	})
	it('confirms deletion, allows cancellation, and retains confirmation after failure for retry', async () => {
		setup()
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Delete group First group',
			}),
		)
		expect(
			screen.getByText(/2 puzzles will be unassigned, not deleted/),
		).toBeInTheDocument()
		expect(mocks.manage).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: 'Keep group' }))
		expect(
			screen.queryByRole('dialog', { name: 'Confirm group deletion' }),
		).not.toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('button', { name: 'Delete group First group' }),
		)
		mocks.manage.mockRejectedValueOnce(
			new Error('Remove reward dependencies'),
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Confirm delete group' }),
		)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Remove reward dependencies',
		)
		expect(
			screen.getByRole('dialog', { name: 'Confirm group deletion' }),
		).toBeInTheDocument()
		mocks.load.mockResolvedValue([])
		fireEvent.click(
			screen.getByRole('button', { name: 'Confirm delete group' }),
		)
		await screen.findByText('No puzzle groups yet.')
		expect(screen.queryByRole('list')).not.toBeInTheDocument()
		expect(screen.getByRole('status')).toHaveTextContent(
			'Its puzzles remain in the library',
		)
		expect(mocks.manage).toHaveBeenCalledTimes(2)
		expect(mocks.manage).toHaveBeenLastCalledWith(
			expect.anything(),
			'group',
			{ kind: 'delete' },
		)
	})
	it('prevents duplicate deletion and navigation while deletion is in flight', async () => {
		let finish: (() => void) | undefined
		mocks.manage.mockReturnValueOnce(
			new Promise<void>(resolve => {
				finish = resolve
			}),
		)
		setup()
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Delete group First group',
			}),
		)
		const confirm = screen.getByRole('button', {
			name: 'Confirm delete group',
		})
		fireEvent.click(confirm)
		fireEvent.click(confirm)
		expect(mocks.manage).toHaveBeenCalledOnce()
		expect(screen.getByRole('status')).toHaveTextContent(
			'Deleting puzzle group…',
		)
		expect(screen.getByRole('status').querySelector('img')).toHaveAttribute(
			'aria-hidden',
			'true',
		)
		expect(isProtected()).toBe(true)
		expect(
			screen.getByRole('button', { name: 'Keep group' }),
		).toBeDisabled()
		mocks.load.mockResolvedValue([])
		finish?.()
		await screen.findByText('No puzzle groups yet.')
	})
	it('creates a named group with a purpose, shape, and track and no fixed puzzle count, retaining retry identity', async () => {
		setup()
		await screen.findByRole('button', { name: 'Edit group First group' })
		fireEvent.click(screen.getByRole('button', { name: 'New group' }))
		expect(
			screen.getByRole('dialog', { name: 'New puzzle group' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Edit group First group' }),
		).toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Group name'), {
			target: { value: 'New collection' },
		})
		fireEvent.change(screen.getByLabelText('Purpose'), {
			target: { value: 'pack' },
		})
		expect(screen.getByLabelText('Shape')).toHaveValue('hexagon')
		fireEvent.change(screen.getByLabelText('Shape'), {
			target: { value: 'triangle' },
		})
		fireEvent.change(screen.getByLabelText('Track'), {
			target: { value: 'mixed' },
		})
		mocks.manage.mockRejectedValueOnce(new Error('Connection lost'))
		fireEvent.click(screen.getByRole('button', { name: 'Create group' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Connection lost',
		)
		expect(screen.getByLabelText('Group name')).toHaveValue(
			'New collection',
		)
		const id = mocks.manage.mock.calls[0][1]
		mocks.load.mockResolvedValue([
			{
				...draftGroup,
				purpose: 'pack',
				track: 'mixed',
				row: {
					...draftGroup.row,
					id,
					name: 'New collection',
					purpose: 'pack',
					track: 'mixed',
					shape_id: 'triangle',
				},
				members: [],
			},
		])
		fireEvent.click(screen.getByRole('button', { name: 'Create group' }))
		await screen.findByRole('button', {
			name: 'Edit group New collection',
		})
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'New group' })).toBeEnabled()
		expect(mocks.manage.mock.calls[1]).toEqual(mocks.manage.mock.calls[0])
		expect(mocks.manage).toHaveBeenLastCalledWith(expect.anything(), id, {
			kind: 'create',
			name: 'New collection',
			details: { purpose: 'pack', shape: 'triangle', track: 'mixed' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'New group' }))
		expect(screen.getByLabelText('Group name')).toHaveValue('')
		expect(screen.getByLabelText('Purpose')).toHaveValue('core')
		expect(screen.getByLabelText('Shape')).toHaveValue('hexagon')
		expect(screen.getByLabelText('Track')).toHaveValue('basic')
	})
	it('creates a daily group without a shape or track', async () => {
		setup()
		await screen.findByRole('button', { name: 'Edit group First group' })
		fireEvent.click(screen.getByRole('button', { name: 'New group' }))
		fireEvent.change(screen.getByLabelText('Group name'), {
			target: { value: 'October' },
		})
		fireEvent.change(screen.getByLabelText('Purpose'), {
			target: { value: 'daily' },
		})
		expect(screen.queryByLabelText('Shape')).not.toBeInTheDocument()
		expect(screen.queryByLabelText('Track')).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Create group' }))
		await waitFor(() =>
			expect(mocks.manage).toHaveBeenCalledWith(
				expect.anything(),
				expect.any(String),
				{
					kind: 'create',
					name: 'October',
					details: { purpose: 'daily', shape: null, track: null },
				},
			),
		)
	})
	it('guards unsaved names and renames the group, keeping its purpose, shape, and track', async () => {
		setup()
		await open()
		fireEvent.change(screen.getByLabelText('Group name'), {
			target: { value: 'Revised' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Groups tab' }))
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		expect(screen.getByLabelText('Group name')).toHaveValue('Revised')
		mocks.load.mockResolvedValue([
			{ ...draftGroup, row: { ...draftGroup.row, name: 'Revised' } },
		])
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText('Group saved.')
		await waitFor(() =>
			expect(
				screen.queryByText('Loading puzzle groups...'),
			).not.toBeInTheDocument(),
		)
		fireEvent.click(screen.getByRole('button', { name: 'Groups tab' }))
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(mocks.manage).toHaveBeenCalledWith(expect.anything(), 'group', {
			kind: 'update',
			name: 'Revised',
			details: { purpose: 'core', shape: 'hexagon', track: 'basic' },
		})
	})
	it('edits purpose, shape, and track together with the name in one update', async () => {
		setup()
		await open()
		expect(screen.getByLabelText('Purpose')).toHaveValue('core')
		expect(screen.getByLabelText('Shape')).toHaveValue('hexagon')
		expect(screen.getByLabelText('Track')).toHaveValue('basic')
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
		fireEvent.change(screen.getByLabelText('Purpose'), {
			target: { value: 'pack' },
		})
		fireEvent.change(screen.getByLabelText('Shape'), {
			target: { value: 'triangle' },
		})
		fireEvent.change(screen.getByLabelText('Track'), {
			target: { value: 'mixed' },
		})
		expect(isProtected()).toBe(true)
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText('Group saved.')
		expect(mocks.manage).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			'group',
			{
				kind: 'update',
				name: 'First group',
				details: { purpose: 'pack', shape: 'triangle', track: 'mixed' },
			},
		)
		expect(isProtected()).toBe(false)
		fireEvent.click(screen.getByRole('button', { name: 'Groups tab' }))
		expect(
			await screen.findByText('Pack · Triangle · Mixed'),
		).toBeInTheDocument()
	})
	it('drops the shape and track when a group becomes daily', async () => {
		setup()
		await open()
		fireEvent.change(screen.getByLabelText('Purpose'), {
			target: { value: 'daily' },
		})
		expect(screen.queryByLabelText('Shape')).not.toBeInTheDocument()
		expect(screen.queryByLabelText('Track')).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText('Group saved.')
		expect(mocks.manage).toHaveBeenCalledWith(expect.anything(), 'group', {
			kind: 'update',
			name: 'First group',
			details: { purpose: 'daily', shape: null, track: null },
		})
	})
	it('keeps a failed purpose change editable with the server error', async () => {
		mocks.manage.mockRejectedValueOnce(
			new Error('Puzzle "A" does not match the group\'s shape or track.'),
		)
		setup()
		await open()
		fireEvent.change(screen.getByLabelText('Track'), {
			target: { value: 'rotation' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'does not match the group',
		)
		expect(screen.getByLabelText('Track')).toHaveValue('rotation')
		expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
	})
	it('filters the gallery by purpose, shape, and track', async () => {
		const group = (
			id: string,
			purpose: PuzzleGroup['purpose'],
			shape: string | null,
			track: PuzzleGroup['track'],
		): PuzzleGroup => ({
			...draftGroup,
			purpose,
			track,
			row: {
				...draftGroup.row,
				id,
				name: id,
				purpose,
				shape_id: shape,
				track,
			},
		})
		mocks.load.mockResolvedValue([
			group('Hex basic core', 'core', 'hexagon', 'basic'),
			group('Hex rotation core', 'core', 'hexagon', 'rotation'),
			group('Triangle pack', 'pack', 'triangle', 'mixed'),
			group('October', 'daily', null, null),
		])
		setup()
		await screen.findByRole('listitem', { name: 'Group October' })
		const names = () =>
			screen
				.getAllByRole('listitem')
				.map(item => item.getAttribute('aria-label'))
		expect(names()).toHaveLength(4)
		fireEvent.change(screen.getByLabelText('Show purpose'), {
			target: { value: 'core' },
		})
		expect(names()).toEqual([
			'Group Hex basic core',
			'Group Hex rotation core',
		])
		fireEvent.change(screen.getByLabelText('Show track'), {
			target: { value: 'rotation' },
		})
		expect(names()).toEqual(['Group Hex rotation core'])
		fireEvent.change(screen.getByLabelText('Show purpose'), {
			target: { value: 'all' },
		})
		fireEvent.change(screen.getByLabelText('Show track'), {
			target: { value: 'all' },
		})
		fireEvent.change(screen.getByLabelText('Show shape'), {
			target: { value: 'triangle' },
		})
		expect(names()).toEqual(['Group Triangle pack'])
		fireEvent.change(screen.getByLabelText('Show shape'), {
			target: { value: 'none' },
		})
		expect(names()).toEqual(['Group October'])
		fireEvent.change(screen.getByLabelText('Show track'), {
			target: { value: 'basic' },
		})
		expect(
			screen.getByText('No puzzle groups match these filters.'),
		).toBeInTheDocument()
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
		fireEvent.click(screen.getByRole('button', { name: 'Groups tab' }))
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		mocks.load.mockResolvedValue([
			{
				...draftGroup,
				members: [...draftGroup.members].reverse(),
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
		expect(mocks.manage).toHaveBeenCalledWith(expect.anything(), 'group', {
			kind: 'reorder',
			puzzleIds: ['b', 'a'],
		})
		expect(isProtected()).toBe(true)
		finish?.()
		await screen.findByText('Group saved.')
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(),
		)
		const remove = await screen.findByRole('button', {
			name: 'Remove Puzzle A from group',
		})
		fireEvent.click(remove)
		await screen.findByText('Puzzle removed from group.')
		expect(mocks.manage).toHaveBeenLastCalledWith(
			expect.anything(),
			'group',
			{ kind: 'remove', puzzleIds: ['a'] },
		)
	})
	it('surfaces membership mutation errors without losing members and can retry', async () => {
		setup()
		await open()
		mocks.manage.mockRejectedValueOnce(
			new Error('Unschedule the puzzle first'),
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove Puzzle A from group' }),
		)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Unschedule the puzzle first',
		)
		expect(screen.getByText('1. Puzzle A')).toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove Puzzle A from group' }),
		)
		await screen.findByText('Puzzle removed from group.')
	})
	it('shows load errors and refreshes instead of reporting an empty catalog', async () => {
		mocks.load.mockRejectedValueOnce(new Error('Offline'))
		setup()
		expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
		expect(
			screen.queryByText('No puzzle groups yet.'),
		).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Refresh groups' }))
		await screen.findByRole('button', { name: 'Edit group First group' })
	})
	it('saves the name and order together without reloading the catalog', async () => {
		setup()
		await open()
		fireEvent.change(screen.getByLabelText('Group name'), {
			target: { value: 'Revised' },
		})
		fireEvent.keyDown(
			screen.getByRole('button', { name: 'Reorder Puzzle A' }),
			{ key: 'ArrowDown' },
		)
		fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText('Group saved.')
		expect(screen.getByText('1. Puzzle B')).toBeInTheDocument()
		expect(screen.getByLabelText('Group name')).toHaveValue('Revised')
		expect(mocks.load).toHaveBeenCalledOnce()
		expect(isProtected()).toBe(false)
		fireEvent.click(screen.getByRole('button', { name: 'Groups tab' }))
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(
			await screen.findByRole('button', { name: 'Edit group Revised' }),
		).toBeInTheDocument()
	})
})

describe('releasing groups', () => {
	// Core and bonus groups in a slot are released as a package, only from the Release tab.
	const pack = (release: {
		published_at: string | null
		release_at: string | null
	}): PuzzleGroup => ({
		...draftGroup,
		row: { ...draftGroup.row, purpose: 'pack', ...release },
		purpose: 'pack',
	})
	const draftPack = pack({ published_at: null, release_at: null })
	const scheduledPack = pack({
		published_at: '2026-01-01T00:00:00Z',
		release_at: '2999-01-01T00:00:00Z',
	})
	const livePack = pack({
		published_at: '2000-01-01T00:00:00Z',
		release_at: '2000-01-01T00:00:00Z',
	})
	const releasePlan = (action: 'schedule' | 'cancel') => ({
		action,
		kind: 'puzzle_group',
		id: 'group',
		name: 'First group',
		state: 'draft',
		releaseAt: null,
		items: [
			{
				kind: 'puzzle_group',
				id: 'group',
				name: 'First group',
				state: 'draft',
				change: action === 'cancel' ? 'cancel' : 'release',
				previousReleaseAt: null,
				releaseAt: null,
			},
		],
		blockers: [],
		warnings: [],
	})

	it('offers to schedule a draft pack group and opens the release dialog', async () => {
		mocks.load.mockResolvedValue([draftPack])
		mocks.preview.mockResolvedValue(releasePlan('schedule'))
		setup()
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Schedule group First group',
			}),
		)
		expect(
			await screen.findByRole('heading', {
				name: 'Release "First group"',
			}),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', {
				name: 'Unschedule group First group',
			}),
		).not.toBeInTheDocument()
		expect(screen.queryByText(/^Scheduled for/)).not.toBeInTheDocument()
	})

	it('shows the release time and reschedule and unschedule for a scheduled group', async () => {
		mocks.load.mockResolvedValue([scheduledPack])
		mocks.preview.mockResolvedValue(releasePlan('cancel'))
		mocks.apply.mockResolvedValue(releasePlan('cancel'))
		setup()
		expect(await screen.findByText(/^Scheduled for /)).toBeInTheDocument()
		expect(
			screen.getByRole('button', {
				name: 'Reschedule group First group',
			}),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', {
				name: 'Schedule group First group',
			}),
		).not.toBeInTheDocument()
		fireEvent.click(
			screen.getByRole('button', {
				name: 'Unschedule group First group',
			}),
		)
		fireEvent.click(
			await within(await screen.findByRole('dialog')).findByRole(
				'button',
				{ name: 'Unschedule' },
			),
		)
		expect(
			await screen.findByText('Unscheduled "First group".'),
		).toBeInTheDocument()
		// The release dialog refreshes the cached groups.
		await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2))
	})

	it('shows a live group without release buttons', async () => {
		mocks.load.mockResolvedValue([livePack])
		setup()
		expect(await screen.findByText('Live')).toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: /chedule/ }),
		).not.toBeInTheDocument()
	})

	it('leaves core and bonus groups to the Release tab, though it shows their state', async () => {
		mocks.load.mockResolvedValue([
			{
				...draftGroup,
				row: {
					...draftGroup.row,
					published_at: '2026-01-01T00:00:00Z',
					release_at: '2999-01-01T00:00:00Z',
				},
			},
		])
		setup()
		expect(await screen.findByText(/^Scheduled for /)).toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: /chedule/ }),
		).not.toBeInTheDocument()
		await open()
		expect(
			screen.queryByRole('button', { name: /chedule/ }),
		).not.toBeInTheDocument()
	})

	it('offers scheduling from inside an open pack group, but not with unsaved changes', async () => {
		mocks.load.mockResolvedValue([draftPack])
		setup()
		await open()
		expect(
			screen.getByRole('button', { name: 'Schedule group First group' }),
		).toBeEnabled()
		fireEvent.change(screen.getByLabelText('Group name'), {
			target: { value: 'Revised' },
		})
		expect(
			screen.getByRole('button', { name: 'Schedule group First group' }),
		).toBeDisabled()
	})
})
