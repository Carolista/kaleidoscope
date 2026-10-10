import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from './state/AppContext'
import App from './App'
import { useIsTouchDevice } from './hooks/useIsTouchDevice'

vi.mock('./hooks/useIsTouchDevice')
const mockUseIsTouchDevice = vi.mocked(useIsTouchDevice)

function renderApp() {
	return render(<App />, { wrapper: AppStateProvider })
}

describe('App', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('shows the controls modal on first-ever load, regardless of touch', () => {
		mockUseIsTouchDevice.mockReturnValue(false)
		renderApp()
		expect(
			screen.getByRole('heading', { name: 'Controls' }),
		).toBeInTheDocument()
	})

	it('dismisses the controls modal via its close button', async () => {
		mockUseIsTouchDevice.mockReturnValue(false)
		const user = userEvent.setup()
		renderApp()

		await user.click(
			screen.getByRole('button', { name: 'Close controls help' }),
		)
		expect(
			screen.queryByRole('heading', { name: 'Controls' }),
		).not.toBeInTheDocument()
	})

	it('does not show the controls modal on load for a device that already has a saved design', () => {
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
		mockUseIsTouchDevice.mockReturnValue(false)
		renderApp()
		expect(
			screen.queryByRole('heading', { name: 'Controls' }),
		).not.toBeInTheDocument()
	})

	it('reopens the controls modal via its circle-info icon button', async () => {
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
		mockUseIsTouchDevice.mockReturnValue(false)
		const user = userEvent.setup()
		renderApp()

		expect(
			screen.queryByRole('heading', { name: 'Controls' }),
		).not.toBeInTheDocument()
		await user.click(
			screen.getByRole('button', { name: 'Show controls help' }),
		)
		expect(
			screen.getByRole('heading', { name: 'Controls' }),
		).toBeInTheDocument()
	})

	it('only lists the editable-area toggle control on touch devices', () => {
		mockUseIsTouchDevice.mockReturnValue(false)
		renderApp()
		expect(
			screen.queryByText('Show / Hide Editable Area'),
		).not.toBeInTheDocument()
	})

	it('lists the editable-area toggle control on touch devices', () => {
		mockUseIsTouchDevice.mockReturnValue(true)
		renderApp()
		expect(
			screen.getByText('Show / Hide Editable Area'),
		).toBeInTheDocument()
	})

	it('renders the hexagon grid by default and switches to the triangle grid via the shape picker', async () => {
		// Avoids the first-ever-load controls modal (see above tests) so it
		// doesn't sit open over the shape picker this test interacts with.
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
		mockUseIsTouchDevice.mockReturnValue(false)
		const user = userEvent.setup()
		renderApp()

		expect(
			screen.getByRole('group', { name: 'Kaleidoscope hexagon grid' }),
		).toBeInTheDocument()

		await user.click(
			screen.getByRole('button', { name: 'Select a different shape' }),
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
