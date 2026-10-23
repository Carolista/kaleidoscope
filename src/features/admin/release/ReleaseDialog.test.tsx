import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReleaseItem, ReleasePlan } from '@/features/admin/services'
import type { Database } from '@/lib/supabase'
import ReleaseDialog, { type ReleaseTarget } from './ReleaseDialog'

const mocks = vi.hoisted(() => ({ preview: vi.fn(), apply: vi.fn() }))
vi.mock('@/features/admin/services/release', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/release')
	>()),
	previewRelease: (...args: unknown[]) => mocks.preview(...args),
	applyRelease: (...args: unknown[]) => mocks.apply(...args),
}))

const client = {} as SupabaseClient<Database>
const group: ReleaseTarget = {
	action: 'schedule',
	kind: 'puzzle_group',
	id: 'g1',
	name: 'Core basic',
}
const item = (
	kind: ReleaseItem['kind'],
	id: string,
	change: ReleaseItem['change'] = 'release',
	previousReleaseAt: string | null = null,
): ReleaseItem => ({
	kind,
	id,
	name: `Name ${id}`,
	state: change === 'live' ? 'live' : 'draft',
	change,
	previousReleaseAt,
	releaseAt: '2026-11-01T12:00:00.000Z',
})
const plan = (overrides: Partial<ReleasePlan> = {}): ReleasePlan => ({
	action: 'schedule',
	kind: 'puzzle_group',
	id: 'g1',
	name: 'Core basic',
	state: 'draft',
	releaseAt: '2026-11-01T12:00:00.000Z',
	items: [
		item('palette', 'p1'),
		item('palette', 'p2', 'earlier', '2026-12-01T12:00:00.000Z'),
		item('puzzle', 'z1'),
		item('puzzle', 'z2'),
		item('puzzle_group', 'g1'),
	],
	blockers: [],
	warnings: [],
	...overrides,
})

function renderDialog(target: ReleaseTarget = group) {
	const onDone = vi.fn()
	const onCancel = vi.fn()
	render(
		<ReleaseDialog
			open
			onAfterClose={() => {}}
			client={client}
			target={target}
			onDone={onDone}
			onCancel={onCancel}
		/>,
	)
	return { onDone, onCancel }
}
const confirmButton = (name: string) =>
	within(screen.getByRole('dialog')).getByRole('button', { name })

beforeEach(() => {
	vi.resetAllMocks()
	mocks.preview.mockResolvedValue(plan())
	mocks.apply.mockResolvedValue(plan())
})

describe('scheduling', () => {
	it('waits for a release time before checking anything', async () => {
		renderDialog()
		expect(
			await screen.findByText(
				'Choose a release time to see what will be released.',
			),
		).toBeInTheDocument()
		expect(mocks.preview).not.toHaveBeenCalled()
		expect(confirmButton('Schedule')).toBeDisabled()
	})

	it('previews what a chosen time releases, then schedules it', async () => {
		const { onDone } = renderDialog()
		fireEvent.change(await screen.findByLabelText('Release time'), {
			target: { value: '2026-11-01T09:00' },
		})
		expect(
			await screen.findByText(
				'This schedules 2 palettes, 2 puzzles, and 1 puzzle group.',
			),
		).toBeInTheDocument()
		expect(mocks.preview).toHaveBeenCalledExactlyOnceWith(client, {
			action: 'schedule',
			kind: 'puzzle_group',
			id: 'g1',
			releaseAt: new Date(2026, 10, 1, 9, 0).toISOString(),
		})
		expect(screen.getByText('Name p1')).toBeInTheDocument()
		expect(screen.getByText(/Name p2/)).toHaveTextContent(
			/moves earlier, from/,
		)
		expect(
			screen.getByText('Puzzles (2)', { selector: 'summary' }),
		).toBeInTheDocument()

		fireEvent.click(confirmButton('Schedule'))
		await waitFor(() => expect(onDone).toHaveBeenCalledWith(plan()))
		expect(mocks.apply).toHaveBeenCalledExactlyOnceWith(client, {
			action: 'schedule',
			kind: 'puzzle_group',
			id: 'g1',
			releaseAt: new Date(2026, 10, 1, 9, 0).toISOString(),
		})
	})

	it('releases immediately when asked, with a stronger warning', async () => {
		renderDialog()
		fireEvent.click(await screen.findByLabelText('Release now'))
		expect(
			await screen.findByText(
				'This releases 2 palettes, 2 puzzles, and 1 puzzle group immediately. Live content can never be changed afterward.',
			),
		).toBeInTheDocument()
		expect(mocks.preview).toHaveBeenCalledExactlyOnceWith(client, {
			action: 'schedule',
			kind: 'puzzle_group',
			id: 'g1',
			releaseAt: null,
		})
		expect(screen.getByLabelText('Release time')).toBeDisabled()
		fireEvent.click(confirmButton('Release now'))
		await waitFor(() => expect(mocks.apply).toHaveBeenCalledOnce())
	})

	it('starts from the current time when rescheduling', async () => {
		renderDialog({
			...group,
			currentReleaseAt: new Date(2026, 10, 3, 14, 30).toISOString(),
		})
		expect(
			await screen.findByRole('heading', {
				name: 'Reschedule "Core basic"',
			}),
		).toBeInTheDocument()
		expect(screen.getByLabelText('Release time')).toHaveValue(
			'2026-11-03T14:30',
		)
		expect(await screen.findByText(/This schedules/)).toBeInTheDocument()
		expect(confirmButton('Reschedule')).toBeEnabled()
	})

	it('checks again when the time changes and ignores the old answer', async () => {
		renderDialog()
		const time = await screen.findByLabelText('Release time')
		fireEvent.change(time, { target: { value: '2026-11-01T09:00' } })
		await screen.findByText(/This schedules/)
		let resolve: (value: ReleasePlan) => void = () => {}
		mocks.preview.mockReturnValue(
			new Promise<ReleasePlan>(settle => {
				resolve = settle
			}),
		)
		fireEvent.change(time, { target: { value: '2026-11-02T09:00' } })
		expect(
			await screen.findByText('Checking what this will change…'),
		).toBeInTheDocument()
		expect(screen.queryByText(/This schedules/)).not.toBeInTheDocument()
		expect(confirmButton('Schedule')).toBeDisabled()
		resolve(plan({ releaseAt: '2026-11-02T14:00:00.000Z' }))
		expect(await screen.findByText(/This schedules/)).toBeInTheDocument()
	})
})

describe('blockers and warnings', () => {
	it('lists blockers and refuses to continue', async () => {
		mocks.preview.mockResolvedValue(
			plan({
				blockers: [
					'"Core basic" has 23 puzzles; core groups need exactly 24.',
				],
			}),
		)
		renderDialog()
		fireEvent.click(await screen.findByLabelText('Release now'))
		const alert = await screen.findByText('Cannot go ahead yet')
		expect(alert.closest('[role="alert"]')).toHaveTextContent(
			'has 23 puzzles',
		)
		expect(confirmButton('Release now')).toBeDisabled()
	})

	it('needs the warnings acknowledged before continuing', async () => {
		mocks.preview.mockResolvedValue(
			plan({ warnings: ['Triangle has no basic bonus group yet.'] }),
		)
		renderDialog()
		fireEvent.change(await screen.findByLabelText('Release time'), {
			target: { value: '2026-11-01T09:00' },
		})
		expect(
			await screen.findByText('Triangle has no basic bonus group yet.'),
		).toBeInTheDocument()
		expect(confirmButton('Schedule')).toBeDisabled()
		fireEvent.click(
			screen.getByRole('checkbox', {
				name: 'I have reviewed these warnings',
			}),
		)
		expect(confirmButton('Schedule')).toBeEnabled()
	})

	it('does not offer a plan that changes nothing', async () => {
		mocks.preview.mockResolvedValue(
			plan({ items: [item('puzzle_group', 'g1', 'live')] }),
		)
		renderDialog()
		fireEvent.click(await screen.findByLabelText('Release now'))
		expect(await screen.findByText('Nothing changes.')).toBeInTheDocument()
		expect(confirmButton('Release now')).toBeDisabled()
	})
})

describe('cancelling', () => {
	const cancel: ReleaseTarget = {
		action: 'cancel',
		kind: 'puzzle_group',
		id: 'g1',
		name: 'Core basic',
	}

	it('checks straight away and has no time to choose', async () => {
		mocks.preview.mockResolvedValue(
			plan({
				action: 'cancel',
				releaseAt: null,
				items: [
					item('puzzle', 'z1', 'cancel'),
					item('puzzle_group', 'g1', 'cancel'),
				],
				warnings: [
					'Palettes used by these puzzles stay scheduled until you cancel them in Palettes.',
				],
			}),
		)
		const { onDone } = renderDialog(cancel)
		expect(
			await screen.findByRole('heading', {
				name: 'Unschedule "Core basic"',
			}),
		).toBeInTheDocument()
		expect(screen.queryByLabelText('Release time')).not.toBeInTheDocument()
		expect(
			await screen.findByText(
				'This returns 1 puzzle and 1 puzzle group to draft.',
			),
		).toBeInTheDocument()
		expect(mocks.preview).toHaveBeenCalledExactlyOnceWith(client, {
			action: 'cancel',
			kind: 'puzzle_group',
			id: 'g1',
			releaseAt: null,
		})
		fireEvent.click(
			screen.getByRole('checkbox', {
				name: 'I have reviewed these warnings',
			}),
		)
		mocks.apply.mockResolvedValue(
			plan({ action: 'cancel', releaseAt: null }),
		)
		fireEvent.click(confirmButton('Unschedule'))
		await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
	})
})

describe('failures', () => {
	it('shows a failed check without enabling the button', async () => {
		mocks.preview.mockRejectedValue(
			new Error('Unable to check the release: boom'),
		)
		renderDialog()
		fireEvent.click(await screen.findByLabelText('Release now'))
		expect(
			await screen.findByText('Unable to check the release: boom'),
		).toBeInTheDocument()
		expect(confirmButton('Release now')).toBeDisabled()
	})

	it('keeps the dialog open and shows the error when applying fails', async () => {
		mocks.apply.mockRejectedValue(
			new Error(
				'Unable to change the release: Live content cannot change.',
			),
		)
		const { onDone } = renderDialog()
		fireEvent.click(await screen.findByLabelText('Release now'))
		await screen.findByText(/immediately/)
		fireEvent.click(confirmButton('Release now'))
		expect(
			await screen.findByText(
				'Unable to change the release: Live content cannot change.',
			),
		).toBeInTheDocument()
		expect(onDone).not.toHaveBeenCalled()
		expect(confirmButton('Release now')).toBeEnabled()
	})

	it('blocks navigation while applying', async () => {
		let settle: (value: ReleasePlan) => void = () => {}
		mocks.apply.mockReturnValue(
			new Promise<ReleasePlan>(resolve => {
				settle = resolve
			}),
		)
		renderDialog()
		fireEvent.click(await screen.findByLabelText('Release now'))
		await screen.findByText(/immediately/)
		fireEvent.click(confirmButton('Release now'))
		expect(await screen.findByText('Saving…')).toBeInTheDocument()
		expect(mocks.apply).toHaveBeenCalledOnce()
		settle(plan())
		await waitFor(() =>
			expect(screen.queryByText('Saving…')).not.toBeInTheDocument(),
		)
	})
})
