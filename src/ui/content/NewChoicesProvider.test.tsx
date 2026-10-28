import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { palettes, testContent } from '@/test/playerContent'
import { PlayerProgressProvider } from './PlayerProgressProvider'
import { useNewChoices } from './NewChoicesContext'
import type { PlayerContent } from './playerContent'

function Probe() {
	const { newPalettes, newShapes, markPalettesSeen, markShapesSeen } =
		useNewChoices()
	return (
		<>
			<p>palettes: {String(newPalettes)}</p>
			<p>shapes: {String(newShapes)}</p>
			<button type="button" onClick={markPalettesSeen}>
				see palettes
			</button>
			<button type="button" onClick={markShapesSeen}>
				see shapes
			</button>
		</>
	)
}

const base: PlayerContent = {
	...testContent,
	palettes: palettes.slice(0, 3),
	unlockedShapes: ['hexagon'],
}

function show(content: PlayerContent) {
	return (
		<PlayerProgressProvider content={content}>
			<Probe />
		</PlayerProgressProvider>
	)
}

describe('NewChoicesProvider', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('shows nothing as new to a player with no record', () => {
		render(show(base))
		expect(screen.getByText('palettes: false')).toBeInTheDocument()
		expect(screen.getByText('shapes: false')).toBeInTheDocument()
	})

	it('flags palettes and shapes earned later until each picker is opened', async () => {
		const user = userEvent.setup()
		const { rerender } = render(show(base))
		rerender(
			show({
				...base,
				palettes: palettes.slice(0, 4),
				unlockedShapes: ['hexagon', 'triangle'],
			}),
		)
		expect(screen.getByText('palettes: true')).toBeInTheDocument()
		expect(screen.getByText('shapes: true')).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'see palettes' }))
		expect(screen.getByText('palettes: false')).toBeInTheDocument()
		expect(screen.getByText('shapes: true')).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'see shapes' }))
		expect(screen.getByText('shapes: false')).toBeInTheDocument()
	})

	it('remembers what was seen across visits', async () => {
		const user = userEvent.setup()
		const more = { ...base, palettes: palettes.slice(0, 4) }
		const first = render(show(base))
		first.rerender(show(more))
		await user.click(screen.getByRole('button', { name: 'see palettes' }))
		first.unmount()

		render(show(more))
		expect(screen.getByText('palettes: false')).toBeInTheDocument()
	})
})
