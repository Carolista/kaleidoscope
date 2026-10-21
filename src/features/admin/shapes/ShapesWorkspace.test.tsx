import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithNavigationGuard as render } from '@/features/admin/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import ShapesWorkspace from './ShapesWorkspace'

const mocks = vi.hoisted(() => ({ counts: vi.fn() }))
vi.mock('@/features/admin/services/shapePuzzleCounts', () => ({
	loadShapePuzzleCounts: (...args: unknown[]) => mocks.counts(...args),
}))

const client = {} as SupabaseClient<Database>
const counts = {
	hexagon: 5,
	triangle: 0,
	diamondStar: 0,
	hexagram: 0,
	circleRings: 0,
	pinwheel: 0,
}

beforeEach(() => {
	vi.resetAllMocks()
	mocks.counts.mockResolvedValue(counts)
})

// The cells of the row headed `header` in the named table (the header itself is not a cell).
function rowCells(root: HTMLElement, table: string, header: string) {
	const row = within(within(root).getByRole('table', { name: table }))
		.getByRole('rowheader', {
			name: text => text.startsWith(header),
		})
		.closest('tr') as HTMLElement
	return within(row)
		.getAllByRole('cell')
		.map(cell => cell.textContent)
}

const card = (name: string) => screen.findByRole('region', { name })

describe('shapes workbench', () => {
	it('shows a shape that already has puzzles as read-only values', async () => {
		render(<ShapesWorkspace client={client} />)
		const hexagon = await card('Hexagon')
		expect(hexagon).toHaveTextContent('Locked: 5 puzzles use these values.')
		expect(rowCells(hexagon, 'Hexagon grid sizes', 'S')).toEqual([
			'3',
			'6',
			'37',
		])
		expect(rowCells(hexagon, 'Hexagon recipes', 'HARD (L)')).toEqual([
			'',
			'7',
			'3, 3, 3, 3, 2, 1, 1',
		])
		expect(within(hexagon).queryByRole('textbox')).not.toBeInTheDocument()
		expect(
			within(hexagon).queryByRole('spinbutton'),
		).not.toBeInTheDocument()
		expect(
			within(hexagon).queryByRole('button', {
				name: 'Reset to the shipped values',
			}),
		).not.toBeInTheDocument()
	})

	it('lets a shape with no puzzles be tried out, and says nothing is saved', async () => {
		render(<ShapesWorkspace client={client} />)
		const triangle = await card('Triangle')
		expect(triangle).toHaveTextContent(
			'No puzzles yet, so you can try values out. Nothing is saved.',
		)
		expect(within(triangle).getByLabelText('Triangle n for M')).toHaveValue(
			7,
		)
		expect(
			within(triangle).getByLabelText('Triangle pieces for HARD (L)'),
		).toHaveValue('4, 4, 4, 3, 3, 2, 1, 1')
	})

	it('swaps the sample with the recipe buttons and builds a new one on request', async () => {
		render(<ShapesWorkspace client={client} />)
		const hexagon = await card('Hexagon')
		expect(
			within(hexagon).getByRole('heading', { name: 'Sample: EASY (S)' }),
		).toBeInTheDocument()
		fireEvent.click(
			within(hexagon).getByRole('button', { name: 'Preview HARD (L)' }),
		)
		expect(
			within(hexagon).getByRole('heading', { name: 'Sample: HARD (L)' }),
		).toBeInTheDocument()
		expect(
			within(hexagon).getByRole('button', { name: 'Preview HARD (L)' }),
		).toHaveAttribute('aria-pressed', 'true')
		fireEvent.click(
			within(hexagon).getByRole('button', { name: 'Randomize sample' }),
		)
		expect(
			within(hexagon).getByRole('heading', { name: 'Sample: HARD (L)' }),
		).toBeInTheDocument()
	})

	it('explains an n or piece mix that does not work and holds the sample back', async () => {
		render(<ShapesWorkspace client={client} />)
		const triangle = await card('Triangle')
		const n = within(triangle).getByLabelText('Triangle n for S')
		fireEvent.change(n, { target: { value: '6' } })
		expect(triangle).toHaveTextContent(
			'The pieces add up to 7, but the wedge has 9 cells.',
		)
		// Both small recipes share n, so each flags its mix, and the sample is held back.
		const alerts = within(triangle).getAllByRole('alert')
		expect(alerts).toHaveLength(3)
		for (const alert of alerts)
			expect(alert).toHaveTextContent(
				'The pieces add up to 7, but the wedge has 9 cells.',
			)
		expect(
			rowCells(triangle, 'Triangle grid sizes', 'S').slice(-2),
		).toEqual(['9', '36'])
		fireEvent.change(
			within(triangle).getByLabelText('Triangle pieces for EASY (S)'),
			{ target: { value: '4, 3, 2' } },
		)
		expect(rowCells(triangle, 'Triangle recipes', 'EASY (S)')[1]).toBe('3')
		expect(within(triangle).getAllByRole('alert')).toHaveLength(1)
		fireEvent.change(n, { target: { value: '0' } })
		expect(triangle).toHaveTextContent('Enter a whole number of 1 or more.')
	})

	it('marks every value that differs from the shipped one, and says what it was', async () => {
		render(<ShapesWorkspace client={client} />)
		const triangle = await card('Triangle')
		expect(within(triangle).queryByText('Changed')).not.toBeInTheDocument()
		fireEvent.change(
			within(triangle).getByLabelText('Triangle pieces for HARD (L)'),
			{ target: { value: '4,4,4,3,3,2,2' } },
		)
		const recipes = within(triangle).getByRole('table', {
			name: 'Triangle recipes',
		})
		expect(within(recipes).getAllByText('Changed')).toHaveLength(1)
		expect(
			within(recipes).getByText('Shipped: 4, 4, 4, 3, 3, 2, 1, 1'),
		).toBeInTheDocument()
		// Retyping the same numbers with different spacing is not a change.
		fireEvent.change(
			within(triangle).getByLabelText('Triangle pieces for HARD (L)'),
			{ target: { value: '4,4,4,3,3,2,1,1' } },
		)
		expect(within(triangle).queryByText('Changed')).not.toBeInTheDocument()
		// A new n marks its size and both recipes that use it.
		fireEvent.change(within(triangle).getByLabelText('Triangle n for M'), {
			target: { value: '8' },
		})
		const sizes = within(triangle).getByRole('table', {
			name: 'Triangle grid sizes',
		})
		expect(within(sizes).getAllByText('Changed')).toHaveLength(1)
		expect(within(sizes).getByText('Shipped: 7')).toBeInTheDocument()
		expect(within(recipes).getAllByText('Changed')).toHaveLength(2)
		expect(
			within(recipes).getAllByText('n is not the shipped 7'),
		).toHaveLength(2)
	})

	it('edits a pinwheel as rows x columns of steps, with a sample for each combination', async () => {
		render(<ShapesWorkspace client={client} />)
		const pinwheel = await card('Pinwheel')
		const sizes = within(pinwheel).getByRole('table', {
			name: 'Pinwheel grid sizes',
		})
		expect(
			within(sizes).getByRole('columnheader', {
				name: 'Rows × Columns',
			}),
		).toBeInTheDocument()
		expect(
			within(pinwheel).queryByLabelText('Pinwheel n for S'),
		).not.toBeInTheDocument()
		const rows = within(pinwheel).getByLabelText('Pinwheel rows for L')
		const columns = within(pinwheel).getByLabelText(
			'Pinwheel columns for L',
		)
		expect(rows).toHaveValue(4)
		expect(columns).toHaveValue(3)
		// 3 x 3 has 9 cells to fill, so the shipped 3, 3, 3, 2, 1 no longer fits.
		fireEvent.change(rows, { target: { value: '3' } })
		expect(within(sizes).getByText('Shipped: 4 × 3')).toBeInTheDocument()
		expect(
			rowCells(pinwheel, 'Pinwheel grid sizes', 'L').slice(-2),
		).toEqual(['9', '72'])
		expect(
			within(pinwheel).getAllByText(
				'The pieces add up to 12, but the wedge has 9 cells.',
			).length,
		).toBeGreaterThan(0)
		fireEvent.change(
			within(pinwheel).getByLabelText('Pinwheel pieces for HARD (L)'),
			{ target: { value: '4, 3, 2' } },
		)
		fireEvent.click(
			within(pinwheel).getByRole('button', { name: 'Preview HARD (L)' }),
		)
		expect(
			within(pinwheel).getByRole('heading', { name: 'Sample: HARD (L)' }),
		).toBeInTheDocument()
		expect(
			within(pinwheel).getByRole('button', { name: 'Randomize sample' }),
		).toBeInTheDocument()
		fireEvent.change(rows, { target: { value: '10' } })
		expect(
			within(sizes).getByText('Use 1 to 9 steps each way.'),
		).toBeInTheDocument()
		fireEvent.change(rows, { target: { value: '' } })
		expect(rows).toHaveValue(null)
	})

	it('resets tried-out values to the shipped ones', async () => {
		render(<ShapesWorkspace client={client} />)
		const triangle = await card('Triangle')
		const reset = within(triangle).getByRole('button', {
			name: 'Reset to the shipped values',
		})
		expect(reset).toBeDisabled()
		const n = within(triangle).getByLabelText('Triangle n for S')
		fireEvent.change(n, { target: { value: '6' } })
		expect(reset).toBeEnabled()
		fireEvent.click(reset)
		expect(n).toHaveValue(5)
		expect(reset).toBeDisabled()
	})

	it('reports a failure to check which shapes have puzzles', async () => {
		mocks.counts.mockRejectedValueOnce(new Error('Offline'))
		render(<ShapesWorkspace client={client} />)
		expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
	})
})
