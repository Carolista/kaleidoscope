import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
	paletteGroupPurposeLabels,
	puzzleGroupPurposeLabels,
} from '@/features/admin/services'
import GroupCreationDialog from './GroupCreationDialog'

const basics = {
	open: true,
	onAfterClose: vi.fn(),
	title: 'New group',
	formLabel: 'Create group',
	confirmLabel: 'Create group',
	pendingLabel: 'Creating group…',
	onCancel: vi.fn(),
}

describe('group creation dialog', () => {
	it('ignores form submission while closing', () => {
		const onCreate = vi.fn().mockResolvedValue(undefined)
		const dialog = (open: boolean) => (
			<GroupCreationDialog
				{...basics}
				open={open}
				purposes={{ core: 'Core' }}
				initialPurpose="core"
				onCreate={onCreate}
			/>
		)
		const { rerender } = render(dialog(true))
		fireEvent.change(screen.getByLabelText('Group name'), {
			target: { value: 'Already saved' },
		})
		rerender(dialog(false))
		fireEvent.submit(screen.getByLabelText('Create group'))
		expect(onCreate).not.toHaveBeenCalled()
		expect(screen.getByLabelText('Group name')).toBeDisabled()
	})

	it('validates names, submits on Enter, blocks duplicate writes and all dismissal while pending, and retains retry IDs', async () => {
		let fail!: (cause: Error) => void
		const onCreate = vi
			.fn<
				(
					id: string,
					name: string,
					value: { purpose: 'core' | 'pack' },
				) => Promise<void>
			>()
			.mockImplementationOnce(
				() =>
					new Promise((_resolve, reject) => {
						fail = reject
					}),
			)
			.mockRejectedValue(new Error('Try again'))
		const onCancel = vi.fn()
		render(
			<GroupCreationDialog
				{...basics}
				purposes={{ core: 'Core', pack: 'Pack' }}
				initialPurpose="core"
				onCreate={onCreate}
				onCancel={onCancel}
			/>,
		)
		const dialog = screen.getByRole('dialog', { name: 'New group' })
		expect(screen.getByLabelText('Group name')).toHaveFocus()
		const user = userEvent.setup()
		expect(
			screen.getByRole('button', { name: 'Create group' }),
		).toBeDisabled()
		await user.type(screen.getByLabelText('Group name'), '   ')
		expect(
			screen.getByRole('button', { name: 'Create group' }),
		).toBeDisabled()
		await user.clear(screen.getByLabelText('Group name'))
		await user.type(screen.getByLabelText('Group name'), 'First{Enter}')
		fireEvent.submit(screen.getByRole('form', { name: 'Create group' }))
		expect(onCreate).toHaveBeenCalledOnce()
		const request = onCreate.mock.calls[0]
		expect(request).toEqual([
			expect.any(String),
			'First',
			expect.objectContaining({ purpose: 'core', track: null }),
		])
		for (const button of within(dialog).getAllByRole('button'))
			expect(button).toBeDisabled()
		fireEvent(dialog, new Event('cancel', { cancelable: true }))
		fireEvent.click(dialog)
		expect(onCancel).not.toHaveBeenCalled()
		await act(async () => {
			fail(new Error('Lost response'))
		})
		expect(within(dialog).getByRole('alert')).toHaveTextContent(
			'Lost response',
		)
		expect(screen.getByLabelText('Group name')).toHaveValue('First')
		await user.click(screen.getByRole('button', { name: 'Create group' }))
		await screen.findByText('Try again')
		expect(onCreate.mock.calls[1]).toEqual(request)
		await user.selectOptions(screen.getByLabelText('Purpose'), 'pack')
		await user.click(screen.getByRole('button', { name: 'Create group' }))
		await screen.findByText('Try again')
		expect(onCreate.mock.calls[2][0]).not.toBe(request[0])
		expect(onCreate.mock.calls[2][1]).toBe('First')
		expect(onCreate.mock.calls[2][2]).toMatchObject({ purpose: 'pack' })
		await user.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(onCancel).toHaveBeenCalledOnce()
	})

	it('offers only a purpose for palette groups', () => {
		render(
			<GroupCreationDialog
				{...basics}
				purposes={paletteGroupPurposeLabels}
				initialPurpose="undecided"
				onCreate={vi.fn()}
			/>,
		)
		expect(
			within(screen.getByLabelText('Purpose'))
				.getAllByRole('option')
				.map(option => option.textContent),
		).toEqual(['Undecided', 'Core', 'Reward', 'Pack'])
		expect(screen.queryByLabelText('Shape')).not.toBeInTheDocument()
		expect(screen.queryByLabelText('Track')).not.toBeInTheDocument()
	})

	it('offers a shape and a track for puzzle groups that follow the purpose', async () => {
		const user = userEvent.setup()
		const onCreate = vi.fn().mockRejectedValue(new Error('Try again'))
		render(
			<GroupCreationDialog
				{...basics}
				purposes={puzzleGroupPurposeLabels}
				initialPurpose="core"
				puzzleDetails
				onCreate={onCreate}
			/>,
		)
		expect(screen.getByLabelText('Shape')).toHaveValue('hexagon')
		const track = () => screen.getByLabelText('Track')
		const trackOptions = () =>
			within(track())
				.getAllByRole('option')
				.map(option => option.textContent)
		expect(track()).toHaveValue('basic')
		expect(trackOptions()).toEqual(['Basic', 'Rotation'])

		await user.type(screen.getByLabelText('Group name'), 'Triangles')
		await user.selectOptions(screen.getByLabelText('Shape'), 'triangle')
		await user.selectOptions(track(), 'rotation')
		await user.click(screen.getByRole('button', { name: 'Create group' }))
		await screen.findByText('Try again')
		expect(onCreate.mock.calls[0].slice(1)).toEqual([
			'Triangles',
			{ purpose: 'core', shape: 'triangle', track: 'rotation' },
		])

		await user.selectOptions(screen.getByLabelText('Purpose'), 'pack')
		expect(trackOptions()).toEqual(['Basic', 'Rotation', 'Mixed'])
		expect(track()).toHaveValue('rotation')
		await user.selectOptions(track(), 'mixed')
		await user.selectOptions(screen.getByLabelText('Purpose'), 'reward')
		expect(trackOptions()).toEqual(['Basic', 'Rotation'])
		expect(track()).toHaveValue('basic')

		await user.selectOptions(screen.getByLabelText('Purpose'), 'daily')
		expect(screen.queryByLabelText('Shape')).not.toBeInTheDocument()
		expect(screen.queryByLabelText('Track')).not.toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Create group' }))
		await screen.findByText('Try again')
		expect(onCreate.mock.calls[1][2]).toMatchObject({
			purpose: 'daily',
			track: null,
		})

		await user.selectOptions(screen.getByLabelText('Purpose'), 'undecided')
		expect(screen.getByLabelText('Shape')).toHaveValue('triangle')
		expect(screen.queryByLabelText('Track')).not.toBeInTheDocument()
	})
})
