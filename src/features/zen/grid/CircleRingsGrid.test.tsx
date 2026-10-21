import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useIsTouchDevice } from '@/ui/hooks'
import { buildExportClone } from '@/features/zen/export/imageExportService'
import { ZenStateProvider } from '@/features/zen/state'
import {
	CIRCLE_RINGS_GRID_SIZES,
	computeGridAspectRatio,
	getGroupIds,
} from '@/domain/shapes/circle-rings'
import styles from './Cell.module.css'
import CircleRingsGrid from './CircleRingsGrid'

vi.mock('@/ui/hooks/useIsTouchDevice')

beforeEach(() => {
	vi.mocked(useIsTouchDevice).mockReturnValue(false)
})

describe('CircleRingsGrid', () => {
	it('keeps the wedge highlighted across gaps without making them paintable', () => {
		const { container } = render(<CircleRingsGrid />, {
			wrapper: ZenStateProvider,
		})
		const svg = screen.getByRole('group')
		const hoverArea = container.querySelector('path')!
		const decorative = container.querySelector('circle[aria-hidden]')!
		const tile = screen.getAllByRole('button')[1]
		const fillBefore = tile.getAttribute('fill')

		expect(svg.firstElementChild).toBe(hoverArea)
		expect(hoverArea).toHaveAttribute('fill', 'transparent')
		expect(hoverArea).toHaveAttribute('stroke', 'none')
		expect(hoverArea).toHaveAttribute('pointer-events', 'all')
		expect(hoverArea).toHaveAttribute('aria-hidden', 'true')
		expect(hoverArea).not.toHaveAttribute('tabindex')

		fireEvent.pointerMove(tile)
		expect(decorative).toHaveClass(styles.dimmed)
		fireEvent.pointerMove(hoverArea)
		expect(decorative).toHaveClass(styles.dimmed)
		expect(tile).not.toHaveClass(styles.dimmed)
		fireEvent.click(hoverArea)
		expect(tile).toHaveAttribute('fill', fillBefore)
		expect(screen.getByRole('status')).toBeEmptyDOMElement()
		fireEvent.pointerMove(decorative)
		expect(decorative).toHaveClass(styles.dimmed)
		fireEvent.pointerMove(svg)
		expect(decorative).not.toHaveClass(styles.dimmed)
		fireEvent.pointerMove(hoverArea)
		fireEvent.pointerLeave(svg)
		expect(decorative).not.toHaveClass(styles.dimmed)
	})

	it.each([
		{ ringCount: 0, ringSize: 30 },
		{ ringCount: 1, ringSize: 20 },
		{ ringCount: 6, ringSize: 30 },
	])(
		'fits the hover disk to the circle envelope for $ringCount rings at size $ringSize',
		props => {
			const { container } = render(<CircleRingsGrid {...props} />, {
				wrapper: ZenStateProvider,
			})
			const outerRadius = Math.max(
				...[...container.querySelectorAll('circle')].map(
					circle =>
						Math.hypot(
							Number(circle.getAttribute('cx')),
							Number(circle.getAttribute('cy')),
						) + Number(circle.getAttribute('r')),
				),
			)
			expect(container.querySelector('path')).toHaveAttribute(
				'd',
				`M 0 ${-outerRadius} A ${outerRadius} ${outerRadius} 0 1 1 0 ${outerRadius} A ${outerRadius} ${outerRadius} 0 1 1 0 ${-outerRadius} Z`,
			)
		},
	)

	it('leaves the hover disk invisible in exported images', () => {
		const { container } = render(<CircleRingsGrid />, {
			wrapper: ZenStateProvider,
		})
		const clone = buildExportClone(
			container.querySelector('svg')!,
			100,
			100,
		)
		expect(clone.querySelector('path')).toHaveAttribute(
			'fill',
			'transparent',
		)
		expect(clone.querySelector('path')).toHaveAttribute('stroke', 'none')
	})

	it('exposes exactly 12 clickable tiles, each as an accessible, labeled button', () => {
		render(<CircleRingsGrid />, { wrapper: ZenStateProvider })
		const tiles = screen.getAllByRole('button')
		expect(tiles).toHaveLength(12)
		expect(tiles[0]).toHaveAccessibleName('Paint tile 1 of 12')
		expect(tiles[11]).toHaveAccessibleName('Paint tile 12 of 12')
	})

	it('paints a tile on click and announces it via the live region', async () => {
		const user = userEvent.setup()
		render(<CircleRingsGrid />, { wrapper: ZenStateProvider })

		const tile = screen.getByRole('button', {
			name: 'Paint tile 1 of 12',
		})
		const fillBefore = tile.getAttribute('fill')

		await user.click(tile)

		expect(tile.getAttribute('fill')).not.toBe(fillBefore)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Painted tile 1 of 12.',
		)
	})

	it('paints a tile via the keyboard (Enter and Space), not just click', async () => {
		const user = userEvent.setup()
		render(<CircleRingsGrid />, { wrapper: ZenStateProvider })

		const tile = screen.getByRole('button', {
			name: 'Paint tile 2 of 12',
		})
		tile.focus()
		const fillBefore = tile.getAttribute('fill')

		await user.keyboard('{Enter}')
		const fillAfterEnter = tile.getAttribute('fill')
		expect(fillAfterEnter).not.toBe(fillBefore)

		await user.keyboard(' ')
		expect(tile.getAttribute('fill')).not.toBe(fillAfterEnter)
	})

	it('renders every cell as a <circle>, never a <polygon>', () => {
		const { container } = render(<CircleRingsGrid />, {
			wrapper: ZenStateProvider,
		})
		expect(container.querySelectorAll('circle').length).toBeGreaterThan(0)
		expect(container.querySelectorAll('polygon')).toHaveLength(0)
	})

	it('gives every circle a strictly positive radius, with the center dot tied for smallest (with ring 1) and the outermost ring strictly the largest', () => {
		const { container } = render(<CircleRingsGrid />, {
			wrapper: ZenStateProvider,
		})
		const radii = [...container.querySelectorAll('circle')].map(circle =>
			Number(circle.getAttribute('r')),
		)
		for (const r of radii) {
			expect(r).toBeGreaterThan(0)
		}
		// The center dot (1 circle) and ring 1 (6 circles) share the
		// smallest, floor radius.
		const smallest = Math.min(...radii)
		expect(radii.filter(r => r === smallest)).toHaveLength(7)
		expect(smallest).toBeLessThan(Math.max(...radii))
	})

	it.each(Object.entries(CIRCLE_RINGS_GRID_SIZES))(
		'renders the %s grid with %s rings',
		(_size, ringCount) => {
			render(<CircleRingsGrid ringCount={ringCount} />, {
				wrapper: ZenStateProvider,
			})
			const grid = screen.getByRole('group', {
				name: 'Kaleidoscope circle rings grid',
			})
			expect(grid.querySelectorAll('circle')).toHaveLength(
				1 + 3 * ringCount * (ringCount + 1),
			)
			expect(grid.querySelectorAll('[role="button"]')).toHaveLength(
				getGroupIds(ringCount).length,
			)
			expect(grid).toHaveStyle({
				'--grid-aspect-ratio': String(
					computeGridAspectRatio(ringCount),
				),
			})
		},
	)
})
