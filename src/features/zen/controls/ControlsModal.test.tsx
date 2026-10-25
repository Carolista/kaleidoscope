import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { testContent } from '@/test/playerContent'
import { renderWithProvider } from '@/test/renderWithProvider'
import { usePlayerTheme } from '@/ui/theme'
import ControlsModal from './ControlsModal'

function ShowsPalette() {
	const { palette } = usePlayerTheme()
	return <output>{palette.colors.join(',')}</output>
}

describe('ControlsModal', () => {
	it('shows the current palette, not an icon, for Paint Colors', () => {
		renderWithProvider(
			<>
				<ShowsPalette />
				<ControlsModal open onClose={() => {}} />
			</>,
		)
		const colors = screen.getByRole('status').textContent!.split(',')
		const item = screen
			.getByRole('heading', { name: 'Paint Colors' })
			.closest('li')!
		expect(item.querySelector('svg')).toBeNull()
		const swatches = [...item.querySelectorAll<HTMLElement>('span > span')]
		// jsdom normalizes hex to rgb(), so compare through the same normalization.
		const normalized = (color: string) => {
			const probe = document.createElement('span')
			probe.style.backgroundColor = color
			return probe.style.backgroundColor
		}
		expect(swatches.map(swatch => swatch.style.backgroundColor)).toEqual(
			colors.map(normalized),
		)
	})

	it('lists the randomizer only once it has been earned, and no longer lists dark mode', () => {
		const { unmount } = renderWithProvider(
			<ControlsModal open onClose={() => {}} />,
		)
		expect(
			screen.getByRole('heading', { name: 'Randomize Design' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('heading', { name: 'Dark / Light Mode' }),
		).not.toBeInTheDocument()
		unmount()
		renderWithProvider(<ControlsModal open onClose={() => {}} />, {
			...testContent,
			randomizerUnlocked: false,
		})
		expect(
			screen.queryByRole('heading', { name: 'Randomize Design' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('heading', { name: 'Reset Design' }),
		).toBeInTheDocument()
	})

	it('keeps icons for the other controls', () => {
		renderWithProvider(<ControlsModal open onClose={() => {}} />)
		const item = screen
			.getByRole('heading', { name: 'Reset Design' })
			.closest('li')!
		expect(item.querySelector('svg')).not.toBeNull()
	})
})
