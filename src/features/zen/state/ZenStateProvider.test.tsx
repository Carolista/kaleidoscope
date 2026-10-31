import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultGridSizes } from '@/domain/shapes'
import { palettes } from '@/test/playerContent'
import { renderWithProvider } from '@/test/renderWithProvider'
import { usePlayerTheme } from '@/ui/theme'
import { DarkModeToggle } from '@/ui/components'
import { saveThemePreference } from './storageService'

const THEME_KEY = 'kaleidoscope:theme'

function Mode() {
	const { darkMode } = usePlayerTheme()
	return <p>{darkMode ? 'dark' : 'light'}</p>
}

function renderZen() {
	return renderWithProvider(
		<>
			<Mode />
			<DarkModeToggle />
		</>,
	)
}

beforeEach(() => localStorage.clear())

describe('ZenStateProvider and the chosen mode', () => {
	it('saves the mode apart from the design, from the first visit on', () => {
		renderZen()
		expect(screen.getByText('dark')).toBeInTheDocument()
		expect(localStorage.getItem(THEME_KEY)).toBe('dark')
	})

	it('saves each change of mode', async () => {
		renderZen()
		await userEvent.click(
			screen.getByRole('button', { name: 'Switch to light mode' }),
		)
		expect(localStorage.getItem(THEME_KEY)).toBe('light')
		await userEvent.click(
			screen.getByRole('button', { name: 'Switch to dark mode' }),
		)
		expect(localStorage.getItem(THEME_KEY)).toBe('dark')
	})

	it('opens in a mode chosen elsewhere, and does not put it back', () => {
		saveThemePreference(false)
		renderZen()
		expect(screen.getByText('light')).toBeInTheDocument()
		expect(localStorage.getItem(THEME_KEY)).toBe('light')
	})

	it('adds the key for a design saved before the mode had one', () => {
		localStorage.setItem(
			'kaleidoscope:design',
			JSON.stringify({
				version: 6,
				paletteId: palettes[0].id,
				currentColor: palettes[0].colors[0],
				darkMode: false,
				gridShape: 'hexagon',
				gridSizes: { ...defaultGridSizes },
				shapeGroupColors: {},
				savedBoards: {},
			}),
		)
		renderZen()
		expect(screen.getByText('light')).toBeInTheDocument()
		expect(localStorage.getItem(THEME_KEY)).toBe('light')
	})
})
