import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from './state/AppContext'
import App from './App'
import { useIsTouchDevice } from './hooks/useIsTouchDevice'
import { supportedGridShapes } from './data/gridShapes'
import { defaultGridSizes } from './data/gridSizes'
import { colorSchemes } from './data/colorSchemes'
import { savePersistedState } from './services/storageService'

vi.mock('./hooks/useIsTouchDevice')
const mockUseIsTouchDevice = vi.mocked(useIsTouchDevice)

function renderApp() {
	return render(<App />, { wrapper: AppStateProvider })
}

// Any saved record means this isn't a first visit, so the intro is skipped.
function seedSavedDesign() {
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
}

describe('App', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('shows only the intro, with no footer, regular controls, or help modal, on first-ever load', () => {
		mockUseIsTouchDevice.mockReturnValue(false)
		renderApp()
		expect(
			screen.getByRole('heading', { name: 'Welcome!' }),
		).toBeInTheDocument()
		expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
		expect(
			screen.queryByRole('group', { name: 'Controls' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('heading', { name: 'Controls' }),
		).not.toBeInTheDocument()
	})

	it('reveals the full app with the controls modal open after completing the intro', async () => {
		mockUseIsTouchDevice.mockReturnValue(false)
		const user = userEvent.setup()
		renderApp()

		for (let i = 1; i <= 5; i++) {
			await user.click(screen.getByRole('button', { name: `Color ${i}` }))
			await user.click(
				screen.getByRole('button', { name: `Paint tile ${i} of 5` }),
			)
		}
		await user.click(screen.getByRole('button', { name: 'Continue' }))

		expect(
			screen.getByRole('heading', { name: 'Controls' }),
		).toBeInTheDocument()
		expect(screen.getByRole('contentinfo')).toBeInTheDocument()
		expect(
			screen.getByRole('group', { name: 'Kaleidoscope hexagon grid' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('heading', { name: 'Welcome!' }),
		).not.toBeInTheDocument()
	})

	it.each(supportedGridShapes)(
		'renders a restored $id design using the correct grid',
		({ id }) => {
			savePersistedState({
				currentScheme: colorSchemes[0],
				currentColor: colorSchemes[0].colors[0],
				darkMode: true,
				showEditableArea: true,
				gridShape: id,
				gridSizes: { ...defaultGridSizes },
				shapeGroupColors: {},
			})
			mockUseIsTouchDevice.mockReturnValue(false)
			renderApp()
			expect(
				screen.getByRole('group', {
					name: `Kaleidoscope ${id === 'diamondStar' ? 'diamond star' : id === 'circleRings' ? 'circle rings' : id} grid`,
				}),
			).toBeInTheDocument()
		},
	)

	it('dismisses the controls modal via its close button after the intro', async () => {
		mockUseIsTouchDevice.mockReturnValue(false)
		const user = userEvent.setup()
		renderApp()

		for (let i = 1; i <= 5; i++) {
			await user.click(screen.getByRole('button', { name: `Color ${i}` }))
			await user.click(
				screen.getByRole('button', { name: `Paint tile ${i} of 5` }),
			)
		}
		await user.click(screen.getByRole('button', { name: 'Continue' }))
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
		seedSavedDesign()
		mockUseIsTouchDevice.mockReturnValue(false)
		renderApp()
		expect(
			screen.queryByText('Show / Hide Editable Area'),
		).not.toBeInTheDocument()
	})

	it('lists the editable-area toggle control on touch devices', () => {
		seedSavedDesign()
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
		await user.click(screen.getByRole('button', { name: 'Triangle SM' }))
		await user.click(screen.getByRole('button', { name: 'Switch' }))

		const triangleGrid = screen.getByRole('group', {
			name: 'Kaleidoscope triangle grid',
		})
		expect(triangleGrid).toBeInTheDocument()
		expect(triangleGrid.querySelectorAll('polygon')).toHaveLength(16)
		expect(
			screen.getAllByRole('button', { name: /Paint tile/ }),
		).toHaveLength(5)
		expect(
			screen.queryByRole('group', { name: 'Kaleidoscope hexagon grid' }),
		).not.toBeInTheDocument()
	})

	it('switches to the selected Diamond Star size', async () => {
		seedSavedDesign()
		mockUseIsTouchDevice.mockReturnValue(false)
		const user = userEvent.setup()
		renderApp()

		await user.click(
			screen.getByRole('button', { name: 'Select a different shape' }),
		)
		await user.click(
			screen.getByRole('button', { name: 'Diamond Star SM' }),
		)
		await user.click(screen.getByRole('button', { name: 'Switch' }))

		const diamondStarGrid = screen.getByRole('group', {
			name: 'Kaleidoscope diamond star grid',
		})
		expect(diamondStarGrid.querySelectorAll('polygon')).toHaveLength(54)
		expect(
			screen.getAllByRole('button', { name: /Paint tile/ }),
		).toHaveLength(6)
	})
})
