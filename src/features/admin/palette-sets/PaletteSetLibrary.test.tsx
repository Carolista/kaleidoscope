import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/supabase'
import type { PaletteSet } from '@/features/admin/services'
import { managePaletteSet } from '@/features/admin/services'
import PaletteSetLibrary from './PaletteSetLibrary'
import { useState } from 'react'
import { useNavigationGuard } from '@/ui/navigation'

vi.mock('@/features/admin/services/paletteSets', async importOriginal => ({
	...(await importOriginal<
		typeof import('@/features/admin/services/paletteSets')
	>()),
	managePaletteSet: vi.fn(),
}))

const client = {} as SupabaseClient<Database>
const set: PaletteSet = {
	row: {
		id: 'set',
		name: 'Warm colors',
		kind: 'undecided',
		published_at: null,
		release_at: null,
	},
	kind: 'undecided',
	members: [],
}

afterEach(() => vi.resetAllMocks())

describe('palette set loading feedback', () => {
	it('guards revised metadata when the Sets tab is chosen, retaining name/label on cancel and discarding only on confirmation', () => {
		// Mirrors AdminWorkspace: reselecting the Sets tab remounts the library.
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
						Sets tab
					</button>
					<PaletteSetLibrary
						key={visit}
						client={client}
						sets={[set]}
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
			screen.getByRole('button', { name: 'Edit set Warm colors' }),
		)
		fireEvent.change(screen.getByLabelText('Set name'), {
			target: { value: 'Revised colors' },
		})
		fireEvent.change(screen.getByLabelText('Set label'), {
			target: { value: 'reward' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Sets tab' }))
		expect(
			screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
		).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		expect(screen.getByLabelText('Set name')).toHaveValue('Revised colors')
		expect(screen.getByLabelText('Set label')).toHaveValue('reward')
		fireEvent.click(screen.getByRole('button', { name: 'Sets tab' }))
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		expect(
			screen.getByRole('heading', { name: 'Palette sets' }),
		).toBeInTheDocument()
		expect(managePaletteSet).not.toHaveBeenCalled()
	})

	it('keeps cached sets visible but unavailable while refreshing, and shows retry after failure', () => {
		const props = {
			client,
			sets: [set],
			loading: true,
			refreshing: true,
			catalogError: '',
			onChanged: vi.fn(),
			onOrderSaved: vi.fn(),
		}
		const { rerender } = render(<PaletteSetLibrary {...props} />)
		const status = screen.getByRole('status')
		expect(status).toHaveTextContent('Refreshing palette sets…')
		expect(status.querySelector('img')).toHaveAttribute(
			'aria-hidden',
			'true',
		)
		expect(screen.getByText('Warm colors')).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Edit set Warm colors' }),
		).toBeDisabled()
		rerender(
			<PaletteSetLibrary
				{...props}
				loading={false}
				catalogError="Offline"
			/>,
		)
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		expect(screen.getByRole('alert')).toHaveTextContent('Offline')
		expect(
			screen.getByRole('button', { name: 'Edit set Warm colors' }),
		).toBeDisabled()
		fireEvent.click(
			screen.getByRole('button', { name: 'Retry loading sets' }),
		)
		expect(props.onChanged).toHaveBeenCalledOnce()
	})

	it('keeps a failed creation retryable and ends pending feedback', async () => {
		let fail!: (cause: Error) => void
		vi.mocked(managePaletteSet).mockReturnValueOnce(
			new Promise((_resolve, reject) => {
				fail = reject
			}),
		)
		render(
			<PaletteSetLibrary
				client={client}
				sets={[]}
				loading={false}
				catalogError=""
				onChanged={vi.fn()}
				onOrderSaved={vi.fn()}
			/>,
		)
		fireEvent.click(screen.getByRole('button', { name: 'New palette set' }))
		fireEvent.change(screen.getByLabelText('Set name'), {
			target: { value: 'New colors' },
		})
		fireEvent.submit(
			screen.getByRole('form', { name: 'Palette set details' }),
		)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Creating palette set…',
		)
		expect(screen.getByRole('button', { name: 'Save set' })).toBeDisabled()
		await act(async () => {
			fail(new Error('Write failed'))
		})
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		expect(screen.getByRole('alert')).toHaveTextContent('Write failed')
		expect(screen.getByLabelText('Set name')).toHaveValue('New colors')
		expect(screen.getByRole('button', { name: 'Save set' })).toBeEnabled()
	})
})
