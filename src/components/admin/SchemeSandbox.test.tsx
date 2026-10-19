import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateHexagonCells, getGroupIds } from '@/shape-geometry/hexagonGrid'
import type { ColorScheme } from '@/types/colorScheme'
import SchemeSandbox from './SchemeSandbox'

const colors: ColorScheme['colors'] = [
	'#112233',
	'#223344',
	'#334455',
	'#445566',
	'#556677',
]
afterEach(() => vi.restoreAllMocks())

function fills() {
	return [
		...screen
			.getByRole('img', { name: 'Palette sandbox design' })
			.querySelectorAll('polygon'),
	].map(cell => cell.getAttribute('fill'))
}

describe('palette sandbox', () => {
	it('uses the medium hexagon geometry and preserves group symmetry without player state', () => {
		let index = 0
		const random = vi
			.spyOn(Math, 'random')
			.mockImplementation(
				() => [0, 0.2, 0.4, 0.6, 0.8, 0.999][index++ % 6],
			)
		const write = vi.spyOn(Storage.prototype, 'setItem')
		render(<SchemeSandbox colors={colors} />)
		const cells = generateHexagonCells(4)
		const painted = fills()
		expect(painted).toHaveLength(61)
		expect(random).toHaveBeenCalledTimes(getGroupIds(4).length)
		const groups = new Map<string, string | null>()
		for (const [i, cell] of cells.entries()) {
			if (groups.has(cell.groupId))
				expect(painted[i]).toBe(groups.get(cell.groupId))
			groups.set(cell.groupId, painted[i])
		}
		expect(new Set(painted)).toEqual(new Set(colors))
		expect(
			screen.queryByRole('button', { name: /puzzle tile/i }),
		).not.toBeInTheDocument()
		expect(write).not.toHaveBeenCalled()
	})

	it('recolors stable ordered slots even when the original colors are duplicates', () => {
		let index = 0
		const random = vi
			.spyOn(Math, 'random')
			.mockImplementation(() => [0, 0.2, 0.4, 0.6, 0.8][index++ % 5])
		const duplicate: ColorScheme['colors'] = [
			'#abcdef',
			'#abcdef',
			'#abcdef',
			'#abcdef',
			'#abcdef',
		]
		const view = render(<SchemeSandbox colors={duplicate} />)
		const calls = random.mock.calls.length
		expect(new Set(fills())).toEqual(new Set(['#abcdef']))
		view.rerender(<SchemeSandbox colors={colors} />)
		expect(new Set(fills())).toEqual(new Set(colors))
		expect(random).toHaveBeenCalledTimes(calls)
		const original = fills()
		view.rerender(<SchemeSandbox colors={null} />)
		expect(screen.queryByRole('img')).not.toBeInTheDocument()
		expect(
			screen.getByText(/Enter five valid hex colors/),
		).toBeInTheDocument()
		view.rerender(<SchemeSandbox colors={colors} />)
		expect(fills()).toEqual(original)
		expect(random).toHaveBeenCalledTimes(calls)
	})

	it('randomizes only on request, not on parent/theme rerenders', () => {
		const random = vi.spyOn(Math, 'random').mockReturnValue(0)
		const view = render(<SchemeSandbox colors={colors} />)
		const original = fills()
		const calls = random.mock.calls.length
		random.mockReturnValue(0.72)
		view.rerender(<SchemeSandbox colors={colors} />)
		expect(fills()).toEqual(original)
		expect(random).toHaveBeenCalledTimes(calls)
		fireEvent.click(screen.getByRole('button', { name: 'Randomize' }))
		expect(fills()).not.toEqual(original)
		expect(random).toHaveBeenCalledTimes(calls * 2)
	})

	it('gives each ordered palette slot exactly one fifth of the random range', () => {
		const random = vi.spyOn(Math, 'random')
		for (let slot = 0; slot < 5; slot++) {
			for (const value of [slot / 5, (slot + 1) / 5 - 0.000001]) {
				random.mockReturnValue(value)
				const view = render(<SchemeSandbox colors={colors} />)
				expect(new Set(fills())).toEqual(new Set([colors[slot]]))
				view.unmount()
			}
		}
	})
})
