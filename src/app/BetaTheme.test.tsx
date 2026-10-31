import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { palettes } from '@/test/playerContent'
import { defaultGridSizes } from '@/domain/shapes'
import {
	readPersistedDarkMode,
	readThemePreference,
	savePersistedState,
	saveThemePreference,
} from '@/features/zen/state/storageService'
import { DarkModeToggle } from '@/ui/components'
import { usePlayerTheme } from '@/ui/theme'
import BetaTheme from './BetaTheme'

function Mode() {
	const { darkMode } = usePlayerTheme()
	return <p>{darkMode ? 'dark' : 'light'}</p>
}

function renderTheme() {
	return render(
		<BetaTheme>
			<Mode />
			<DarkModeToggle />
		</BetaTheme>,
	)
}

function saveDesign(darkMode: boolean) {
	savePersistedState({
		currentPalette: palettes[0],
		currentColor: palettes[0].colors[0],
		darkMode,
		showEditableArea: true,
		gridShape: 'hexagon',
		gridSizes: { ...defaultGridSizes },
		savedBoards: {},
		shapeGroupColors: {},
	})
}

beforeEach(() => localStorage.clear())

describe('BetaTheme', () => {
	it('starts in the chosen mode, else the saved design’s, else dark', () => {
		const { unmount } = renderTheme()
		expect(screen.getByText('dark')).toBeInTheDocument()
		unmount()
		saveDesign(false)
		const second = renderTheme()
		expect(screen.getByText('light')).toBeInTheDocument()
		second.unmount()
		saveThemePreference(true)
		renderTheme()
		expect(screen.getByText('dark')).toBeInTheDocument()
	})

	it('switches the mode and saves it, so the player pages open the same way', async () => {
		renderTheme()
		await userEvent.click(
			screen.getByRole('button', { name: 'Switch to light mode' }),
		)
		expect(screen.getByText('light')).toBeInTheDocument()
		expect(readPersistedDarkMode()).toBe(false)
		await userEvent.click(
			screen.getByRole('button', { name: 'Switch to dark mode' }),
		)
		expect(screen.getByText('dark')).toBeInTheDocument()
		expect(readPersistedDarkMode()).toBe(true)
	})

	it('saves the mode on a device that has no saved design, leaving the design alone', async () => {
		renderTheme()
		await userEvent.click(
			screen.getByRole('button', { name: 'Switch to light mode' }),
		)
		expect(readThemePreference()).toBe(false)
		expect(localStorage.getItem('kaleidoscope:design')).toBeNull()
	})

	it('leaves a saved design as it is, for Zen to bring in line when it loads', async () => {
		saveDesign(true)
		const saved = localStorage.getItem('kaleidoscope:design')
		renderTheme()
		await userEvent.click(
			screen.getByRole('button', { name: 'Switch to light mode' }),
		)
		expect(localStorage.getItem('kaleidoscope:design')).toBe(saved)
	})
})
