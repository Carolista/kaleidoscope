import { expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { faPalette } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { faXmark } from '@fortawesome/pro-solid-svg-icons'
import { renderWithProvider } from '@/test/renderWithProvider'
import { useAppState } from '@/state/useAppState'
import { withLightness } from '@/utils/colorMath'
import { colorSchemes } from '@/data/colorSchemes'
import PlayerIconButton from './PlayerIconButton'

it('keeps palette tint reactive while leaving single-tone icons untinted', () => {
	function Harness() {
		const { selectScheme, toggleDarkMode, state } = useAppState()
		return (
			<>
				<PlayerIconButton icon={faPalette} label="Palette" />
				<PlayerIconButton icon={faXmark} label="Close" />
				<button onClick={() => selectScheme(colorSchemes[1])}>
					Change palette
				</button>
				<button onClick={toggleDarkMode}>Change theme</button>
				<output>
					{withLightness(
						state.currentScheme.colors[0],
						state.darkMode ? 50 : 70,
					)}
				</output>
			</>
		)
	}
	renderWithProvider(<Harness />)
	function expectTint() {
		expect(
			screen
				.getByRole('button', { name: 'Palette' })
				.querySelector('svg')
				?.style.getPropertyValue('--fa-secondary-color'),
		).toBe(screen.getByRole('status').textContent)
	}
	expectTint()
	fireEvent.click(screen.getByRole('button', { name: 'Change palette' }))
	expectTint()
	fireEvent.click(screen.getByRole('button', { name: 'Change theme' }))
	expectTint()
	expect(
		screen.getByRole('button', { name: 'Close' }).querySelector('svg'),
	).not.toHaveAttribute('style')
})
