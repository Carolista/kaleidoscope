import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { colorSchemes } from '@data/colorSchemes'
import { useIsTouchDevice } from '@hooks/useIsTouchDevice'
import { savePersistedState } from '@services/storageService'
import { useAppState } from '@state/useAppState'
import { renderWithProvider } from '@test/renderWithProvider'
import circleStyles from './CircleCell.module.css'
import polygonStyles from './PolygonCell.module.css'
import GridView from './GridView'
import type { GridCell } from './GridView'

vi.mock('@hooks/useIsTouchDevice')
const mockUseIsTouchDevice = vi.mocked(useIsTouchDevice)
const paintColor = colorSchemes[0].colors[0]

function ToggleHighlight() {
	const { toggleEditableArea } = useAppState()
	return <button onClick={toggleEditableArea}>Toggle highlight</button>
}

beforeEach(() => {
	localStorage.clear()
	savePersistedState({
		currentScheme: colorSchemes[0],
		currentColor: paintColor,
		darkMode: true,
		showEditableArea: true,
		gridShape: 'hexagon',
		shapeGroupColors: {},
	})
	mockUseIsTouchDevice.mockReturnValue(false)
})

describe.each(['polygon', 'circle'] as const)(
	'GridView with %s cells',
	kind => {
		const cells: GridCell[] = [
			{ key: 'a-mirror', groupId: 'a', isClickable: false },
			{ key: 'a', groupId: 'a', isClickable: true },
			{ key: 'b', groupId: 'b', isClickable: true },
		].map(cell =>
			kind === 'circle'
				? { ...cell, kind, center: { x: 10, y: 10 }, radius: 5 }
				: {
						...cell,
						kind,
						corners: [
							{ x: 0, y: 0 },
							{ x: 20, y: 0 },
							{ x: 10, y: 20 },
						],
					},
		)
		const cellStyles = kind === 'circle' ? circleStyles : polygonStyles
		const props = {
			cells,
			viewBox: '0 0 20 20',
			label: 'Test grid',
			instructions: 'Press Enter or Space to paint.',
			sizingAspectRatio: 1,
		}

		it('preserves geometry, SVG ref, numbered labels, and decorative-cell accessibility', () => {
			const svgRef = createRef<SVGSVGElement>()
			const { container } = renderWithProvider(
				<GridView {...props} svgRef={svgRef} />,
			)
			const svg = screen.getByRole('group', { name: 'Test grid' })
			expect(svgRef.current).toBe(svg)
			expect(svg).toHaveAttribute('viewBox', props.viewBox)
			expect(svg).toHaveAccessibleDescription(props.instructions)
			const rendered = container.querySelectorAll(kind)
			expect(rendered).toHaveLength(3)
			expect(rendered[0]).toHaveAttribute('aria-hidden', 'true')
			expect(rendered[0]).not.toHaveAttribute('tabindex')
			expect(screen.getAllByRole('button')).toHaveLength(2)
			expect(rendered[1]).toHaveAccessibleName('Paint tile 1 of 2')
			expect(rendered[2]).toHaveAccessibleName('Paint tile 2 of 2')
			if (kind === 'circle') {
				expect(rendered[1]).toHaveAttribute('cx', '10')
				expect(rendered[1]).toHaveAttribute('cy', '10')
				expect(rendered[1]).toHaveAttribute('r', '5')
			} else {
				expect(rendered[1]).toHaveAttribute('points', '0,0 20,0 10,20')
			}
		})

		it('paints the whole group, toggles it off, and never paints a decorative cell directly', async () => {
			const user = userEvent.setup()
			const { container } = renderWithProvider(<GridView {...props} />)
			const rendered = container.querySelectorAll(kind)
			const tile = screen.getByRole('button', {
				name: 'Paint tile 1 of 2',
			})
			await user.click(rendered[0])
			expect(tile).toHaveAttribute('fill', '#ffffff')
			await user.click(tile)
			expect(tile).toHaveAttribute('fill', paintColor)
			expect(rendered[0]).toHaveAttribute('fill', paintColor)
			expect(rendered[2]).toHaveAttribute('fill', '#ffffff')
			expect(screen.getByRole('status')).toHaveTextContent(
				'Painted tile 1 of 2.',
			)
			await user.click(tile)
			expect(tile).toHaveAttribute('fill', '#ffffff')
			expect(rendered[0]).toHaveAttribute('fill', '#ffffff')
		})

		it('paints with Enter and Space while ignoring unrelated keys', async () => {
			const user = userEvent.setup()
			renderWithProvider(<GridView {...props} />)
			const tile = screen.getByRole('button', {
				name: 'Paint tile 2 of 2',
			})
			tile.focus()
			await user.keyboard('a')
			expect(tile).toHaveAttribute('fill', '#ffffff')
			await user.keyboard('{Enter}')
			expect(tile).toHaveAttribute('fill', paintColor)
			await user.keyboard(' ')
			expect(tile).toHaveAttribute('fill', '#ffffff')
		})

		it('dims only decorative cells while pointing at a cell and clears dimming over empty space or on leave', () => {
			const { container } = renderWithProvider(<GridView {...props} />)
			const rendered = container.querySelectorAll(kind)
			const svg = screen.getByRole('group')
			expect(rendered[0]).not.toHaveClass(cellStyles.dimmed)
			fireEvent.pointerMove(rendered[1])
			expect(rendered[0]).toHaveClass(cellStyles.dimmed)
			expect(rendered[1]).not.toHaveClass(cellStyles.dimmed)
			fireEvent.pointerMove(svg)
			expect(rendered[0]).not.toHaveClass(cellStyles.dimmed)
			fireEvent.pointerMove(rendered[0])
			expect(rendered[0]).toHaveClass(cellStyles.dimmed)
			fireEvent.pointerLeave(svg)
			expect(rendered[0]).not.toHaveClass(cellStyles.dimmed)
		})

		it('uses the touch highlight preference persistently and responds to its toggle', async () => {
			mockUseIsTouchDevice.mockReturnValue(true)
			const { container } = renderWithProvider(
				<>
					<GridView {...props} />
					<ToggleHighlight />
				</>,
			)
			const rendered = container.querySelectorAll(kind)
			expect(rendered[0]).toHaveClass(cellStyles.dimmed)
			expect(rendered[1]).not.toHaveClass(cellStyles.dimmed)
			fireEvent.pointerLeave(screen.getByRole('group'))
			expect(rendered[0]).toHaveClass(cellStyles.dimmed)
			await userEvent.setup().click(screen.getByText('Toggle highlight'))
			expect(rendered[0]).not.toHaveClass(cellStyles.dimmed)
		})

		it('keeps instruction references unique across mounted views', () => {
			renderWithProvider(
				<>
					<GridView {...props} />
					<GridView {...props} label="Second grid" />
				</>,
			)
			const grids = screen.getAllByRole('group')
			expect(grids[0].getAttribute('aria-describedby')).not.toBe(
				grids[1].getAttribute('aria-describedby'),
			)
			expect(grids[0]).toHaveAccessibleDescription(props.instructions)
			expect(grids[1]).toHaveAccessibleDescription(props.instructions)
		})
	},
)
