import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/supabase'
import type { PaletteGroup } from '@/features/admin/services'
import { managePaletteGroup } from '@/features/admin/services'
import PaletteGroupLibrary from './PaletteGroupLibrary'
import { useState } from 'react'
import { useNavigationGuard } from '@/ui/navigation'

vi.mock('@/features/admin/services/paletteGroups', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/paletteGroups')
	>()),
	managePaletteGroup: vi.fn(),
}))

const client = {} as SupabaseClient<Database>
const group: PaletteGroup = {
	row: {
		id: 'group',
		name: 'Warm colors',
		purpose: 'undecided',
		published_at: null,
		release_at: null,
	},
	purpose: 'undecided',
	members: [],
}

afterEach(() => vi.resetAllMocks())

describe('palette group loading feedback', () => {
	it('guards revised metadata when the Groups tab is chosen, retaining name/purpose on cancel and discarding only on confirmation', () => {
		// Mirrors AdminWorkspace: reselecting the Groups tab remounts the library.
		function Harness() {
			const { requestNavigation } = useNavigationGuard()
			const [visit, setVisit] = useState(0)
			return (
				<>
					<button
						onClick={() =>
							requestNavigation(() => setVisit(n => n + 1))
						}
					>
						Groups tab
					</button>
					<PaletteGroupLibrary
						key={visit}
						client={client}
						groups={[group]}
						loading={false}
						catalogError=""
						onChanged={vi.fn()}
						onOrderSaved={vi.fn()}
					/>
				</>
			)
		}
		render(<Harness />)
		fireEvent.click(
			screen.getByRole('button', { name: 'Edit group Warm colors' }),
		)
		fireEvent.change(screen.getByLabelText('Group name'), {
			target: { value: 'Revised colors' },
		})
		fireEvent.change(screen.getByLabelText('Purpose'), {
			target: { value: 'reward' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Groups tab' }))
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		expect(screen.getByLabelText('Group name')).toHaveValue(
			'Revised colors',
		)
		expect(screen.getByLabelText('Purpose')).toHaveValue('reward')
		fireEvent.click(screen.getByRole('button', { name: 'Groups tab' }))
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		expect(
			screen.getByRole('heading', { name: 'Palette groups' }),
		).toBeInTheDocument()
		expect(managePaletteGroup).not.toHaveBeenCalled()
	})

	it('keeps cached groups visible but unavailable while refreshing, and shows retry after failure', () => {
		const props = {
			client,
			groups: [group],
			loading: true,
			refreshing: true,
			catalogError: '',
			onChanged: vi.fn(),
			onOrderSaved: vi.fn(),
		}
		const { rerender } = render(<PaletteGroupLibrary {...props} />)
		const status = screen.getByRole('status')
		expect(status).toHaveTextContent('Refreshing palette groups…')
		expect(status.querySelector('img')).toHaveAttribute(
			'aria-hidden',
			'true',
		)
		expect(screen.getByText('Warm colors')).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Edit group Warm colors' }),
		).toBeDisabled()
		rerender(
			<PaletteGroupLibrary
				{...props}
				loading={false}
				catalogError="Offline"
			/>,
		)
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		expect(screen.getByRole('alert')).toHaveTextContent('Offline')
		expect(
			screen.getByRole('button', { name: 'Edit group Warm colors' }),
		).toBeDisabled()
		fireEvent.click(
			screen.getByRole('button', { name: 'Retry loading groups' }),
		)
		expect(props.onChanged).toHaveBeenCalledOnce()
	})

	it('filters palette groups by purpose and offers no daily purpose', () => {
		const withPurpose = (id: string, purpose: PaletteGroup['purpose']) => ({
			...group,
			row: { ...group.row, id, name: `${purpose} group`, purpose },
			purpose,
		})
		render(
			<PaletteGroupLibrary
				client={client}
				groups={[
					withPurpose('a', 'core'),
					withPurpose('b', 'pack'),
					withPurpose('c', 'undecided'),
				]}
				loading={false}
				catalogError=""
				onChanged={vi.fn()}
				onOrderSaved={vi.fn()}
			/>,
		)
		const filter = screen.getByLabelText('Show purpose')
		expect(
			Array.from(filter.querySelectorAll('option')).map(
				option => option.textContent,
			),
		).toEqual(['All purposes', 'Undecided', 'Core', 'Reward', 'Pack'])
		expect(screen.getAllByRole('listitem')).toHaveLength(3)
		fireEvent.change(filter, { target: { value: 'pack' } })
		expect(screen.getAllByRole('listitem')).toHaveLength(1)
		expect(
			screen.getByRole('listitem', { name: 'Palette group pack group' }),
		).toBeInTheDocument()
		fireEvent.change(filter, { target: { value: 'reward' } })
		expect(
			screen.getByText('No palette groups match this purpose.'),
		).toBeInTheDocument()
	})

	it('keeps a failed creation retryable and ends pending feedback', async () => {
		let fail!: (cause: Error) => void
		vi.mocked(managePaletteGroup).mockReturnValueOnce(
			new Promise((_resolve, reject) => {
				fail = reject
			}),
		)
		render(
			<PaletteGroupLibrary
				client={client}
				groups={[]}
				loading={false}
				catalogError=""
				onChanged={vi.fn()}
				onOrderSaved={vi.fn()}
			/>,
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'New palette group' }),
		)
		fireEvent.change(screen.getByLabelText('Group name'), {
			target: { value: 'New colors' },
		})
		fireEvent.submit(
			screen.getByRole('form', { name: 'Palette group details' }),
		)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Creating palette group…',
		)
		expect(
			screen.getByRole('button', { name: 'Save group' }),
		).toBeDisabled()
		await act(async () => {
			fail(new Error('Write failed'))
		})
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		expect(screen.getByRole('alert')).toHaveTextContent('Write failed')
		expect(screen.getByLabelText('Group name')).toHaveValue('New colors')
		expect(screen.getByRole('button', { name: 'Save group' })).toBeEnabled()
	})
})
