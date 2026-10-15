import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from './state/AppContext'
import App from './App'
import styles from './App.module.css'
import headerStyles from './components/layout/Header.module.css'
import { useIsTouchDevice } from './hooks/useIsTouchDevice'
import { supportedGridShapes } from './data/gridShapes'
import { defaultGridSizes } from './data/gridSizes'
import { PINWHEEL_GRID_SIZES } from '@geometry/pinwheelGrid'
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

	it('moves the centered logo and reveals the page after the star finishes spinning', () => {
		const originalAnimate = Element.prototype.animate
		const animation = {
			cancel: vi.fn(),
			onfinish: null as Animation['onfinish'],
		} as unknown as Animation
		const animate = vi.fn(() => animation)
		Object.defineProperty(Element.prototype, 'animate', {
			configurable: true,
			value: animate,
		})
		vi.stubGlobal('matchMedia', () => ({ matches: false }))
		mockUseIsTouchDevice.mockReturnValue(false)

		const view = renderApp()
		const page = screen.getByRole('main').parentElement
		const title = screen.getByRole('heading', { name: 'Kaleidoscope' })
		const removeClass = vi.spyOn(title.classList, 'remove')
		const rect = (
			left: number,
			top: number,
			width: number,
			height: number,
		) =>
			({
				left,
				top,
				width,
				height,
				right: left + width,
				bottom: top + height,
				x: left,
				y: top,
				toJSON: () => ({}),
			}) as DOMRect
		vi.spyOn(title, 'getBoundingClientRect')
			.mockReturnValueOnce(rect(20, 30, 180, 45))
			.mockReturnValueOnce(rect(200, 300, 360, 90))

		try {
			expect(page).toHaveClass(styles.opening)
			fireEvent.animationEnd(title.querySelector('img')!)

			expect(page).not.toHaveClass(styles.opening)
			expect(removeClass).toHaveBeenCalledWith(headerStyles.openingTitle)
			expect(title).toHaveClass(headerStyles.movingTitle)
			expect(animate).toHaveBeenCalledWith(
				[
					{
						transform: 'translate(-180px, -270px) scale(0.5, 0.5)',
					},
					{ transform: 'none' },
				],
				expect.objectContaining({
					duration: 1400,
					fill: 'both',
				}),
			)
			expect(title).not.toHaveClass(headerStyles.openingTitle)

			act(() =>
				animation.onfinish?.call(
					animation,
					new Event('finish') as AnimationPlaybackEvent,
				),
			)
			expect(page).not.toHaveClass(styles.opening)
			expect(title).not.toHaveClass(headerStyles.movingTitle)
		} finally {
			view.unmount()
			if (originalAnimate) {
				Object.defineProperty(Element.prototype, 'animate', {
					configurable: true,
					value: originalAnimate,
				})
			} else {
				delete (Element.prototype as Partial<Element>).animate
			}
			vi.unstubAllGlobals()
		}
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
				savedBoards: {},
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

	it('renders the selected Circle Rings size', () => {
		savePersistedState({
			currentScheme: colorSchemes[0],
			currentColor: colorSchemes[0].colors[0],
			darkMode: true,
			showEditableArea: true,
			gridShape: 'circleRings',
			gridSizes: { ...defaultGridSizes, circleRings: 'sm' },
			savedBoards: {},
			shapeGroupColors: {},
		})
		mockUseIsTouchDevice.mockReturnValue(false)
		renderApp()

		expect(
			screen
				.getByRole('group', {
					name: 'Kaleidoscope circle rings grid',
				})
				.querySelectorAll('circle'),
		).toHaveLength(37)
	})

	it('renders the selected Pinwheel size', () => {
		savePersistedState({
			currentScheme: colorSchemes[0],
			currentColor: colorSchemes[0].colors[0],
			darkMode: true,
			showEditableArea: true,
			gridShape: 'pinwheel',
			gridSizes: { ...defaultGridSizes, pinwheel: 'sm' },
			savedBoards: {},
			shapeGroupColors: {},
		})
		mockUseIsTouchDevice.mockReturnValue(false)
		renderApp()

		const { rowSteps, colSteps } = PINWHEEL_GRID_SIZES.sm
		expect(
			screen
				.getByRole('group', {
					name: 'Kaleidoscope pinwheel grid',
				})
				.querySelectorAll('polygon'),
		).toHaveLength(8 * rowSteps * colSteps)
	})

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
		await user.click(screen.getByRole('button', { name: 'Triangle (S)' }))

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
			screen.getByRole('button', { name: 'Diamond Star (S)' }),
		)

		const diamondStarGrid = screen.getByRole('group', {
			name: 'Kaleidoscope diamond star grid',
		})
		expect(diamondStarGrid.querySelectorAll('polygon')).toHaveLength(54)
		expect(
			screen.getAllByRole('button', { name: /Paint tile/ }),
		).toHaveLength(6)
	})

	it('switches to the selected Hexagram size and renders its tile count', async () => {
		seedSavedDesign()
		mockUseIsTouchDevice.mockReturnValue(false)
		const user = userEvent.setup()
		renderApp()

		await user.click(
			screen.getByRole('button', { name: 'Select a different shape' }),
		)
		await user.click(screen.getByRole('button', { name: 'Hexagram (S)' }))

		const hexagramGrid = screen.getByRole('group', {
			name: 'Kaleidoscope hexagram grid',
		})
		expect(hexagramGrid.querySelectorAll('polygon')).toHaveLength(48)
		expect(
			screen.getAllByRole('button', { name: /Paint tile/ }),
		).toHaveLength(6)
	})
})
