import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from './state/AppContext'
import App from './App'
import { useIsTouchDevice } from './utils/useIsTouchDevice'

vi.mock('./utils/useIsTouchDevice')
const mockUseIsTouchDevice = vi.mocked(useIsTouchDevice)

function renderApp() {
	return render(<App />, { wrapper: AppStateProvider })
}

describe('App', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('shows the touch intro modal on a touch device with no saved design', () => {
		mockUseIsTouchDevice.mockReturnValue(true)
		renderApp()
		expect(
			screen.getByRole('heading', {
				name: 'How to Switch Your View',
			}),
		).toBeInTheDocument()
	})

	it('dismisses the touch intro modal via its "Got It" button', async () => {
		mockUseIsTouchDevice.mockReturnValue(true)
		const user = userEvent.setup()
		renderApp()

		await user.click(screen.getByRole('button', { name: 'Got It' }))
		expect(
			screen.queryByRole('heading', {
				name: 'How to Switch Your View',
			}),
		).not.toBeInTheDocument()
	})

	it('does not show the touch intro modal on a touch device that already has a saved design', () => {
		// hasPersistedDesign only checks that the storage key exists, not
		// that its contents are well-formed, so an arbitrary scheme name is
		// fine here.
		localStorage.setItem(
			'kaleidoscope:design',
			JSON.stringify({
				version: 1,
				schemeName: 'does not matter for this check',
				currentColor: '#000000',
				darkMode: true,
				showEditableArea: true,
				shapeGroupColors: {},
			}),
		)
		mockUseIsTouchDevice.mockReturnValue(true)
		renderApp()
		expect(
			screen.queryByRole('heading', {
				name: 'How to Switch Your View',
			}),
		).not.toBeInTheDocument()
	})

	it('does not show the touch intro modal on a non-touch device', () => {
		mockUseIsTouchDevice.mockReturnValue(false)
		renderApp()
		expect(
			screen.queryByRole('heading', {
				name: 'How to Switch Your View',
			}),
		).not.toBeInTheDocument()
	})

	it('renders the hexagon grid by default and switches to the triangle grid via the shape picker', async () => {
		mockUseIsTouchDevice.mockReturnValue(false)
		const user = userEvent.setup()
		renderApp()

		expect(
			screen.getByRole('group', { name: 'Kaleidoscope hexagon grid' }),
		).toBeInTheDocument()

		await user.click(
			screen.getByRole('button', { name: 'Open grid shape picker' }),
		)
		await user.click(screen.getByRole('button', { name: 'Triangle' }))
		await user.click(screen.getByRole('button', { name: 'Switch' }))

		expect(
			screen.getByRole('group', { name: 'Kaleidoscope triangle grid' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('group', { name: 'Kaleidoscope hexagon grid' }),
		).not.toBeInTheDocument()
	})
})
