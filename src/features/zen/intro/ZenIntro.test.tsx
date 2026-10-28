import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { palettes, testContent } from '@/test/playerContent'
import { renderWithProvider } from '@/test/renderWithProvider'
import { getThemeColors, INTRO_PALETTE_IDS } from '@/domain/palettes'
import ZenIntro from './ZenIntro'

const FIRST_PALETTE_COLORS = palettes[0].colors

// Picks a color, then the first tile still open to paint.
async function placeColor(
	user: ReturnType<typeof userEvent.setup>,
	colorNumber: number,
) {
	await user.click(
		screen.getByRole('button', { name: `Color ${colorNumber}` }),
	)
	await user.click(screen.getAllByRole('button', { name: /^Paint tile/ })[0])
}

describe('ZenIntro', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('starts with the welcome message, the Harmony palette, and no paintable tiles', () => {
		renderWithProvider(<ZenIntro onContinue={vi.fn()} />)

		expect(
			screen.getByRole('heading', { name: 'Welcome!' }),
		).toBeInTheDocument()
		expect(
			screen.getByText(
				'Choose your first color and place it on the grid.',
			),
		).toBeInTheDocument()

		const swatches = FIRST_PALETTE_COLORS.map((_, i) =>
			screen.getByRole('button', { name: `Color ${i + 1}` }),
		)
		expect(swatches).toHaveLength(5)
		swatches.forEach(swatch => expect(swatch).toBeEnabled())
		expect(
			screen.queryByRole('button', { name: /^Paint tile/ }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Continue' }),
		).not.toBeInTheDocument()
	})

	it('uses the Zen intro palette when it is available', () => {
		const harmony = { ...palettes[3], id: INTRO_PALETTE_IDS.zen }
		renderWithProvider(<ZenIntro onContinue={vi.fn()} />, {
			...testContent,
			palettes: [palettes[0], harmony],
		})
		expect(screen.getByRole('button', { name: 'Color 1' })).toHaveStyle({
			backgroundColor: harmony.colors[0],
		})
	})

	it('offers exactly five paintable tiles of six once a color is chosen, with the center already base color', async () => {
		const user = userEvent.setup()
		renderWithProvider(<ZenIntro onContinue={vi.fn()} />)

		await user.click(screen.getByRole('button', { name: 'Color 1' }))

		expect(
			screen.getAllByRole('button', { name: /^Paint tile \d of 6$/ }),
		).toHaveLength(5)
		const { base } = getThemeColors(true)
		const fills = [
			...screen
				.getByRole('group', { name: 'Kaleidoscope hexagon grid' })
				.querySelectorAll('polygon'),
		].map(cell => cell.getAttribute('fill'))
		expect(fills.filter(fill => fill === base)).not.toHaveLength(0)
		expect(screen.getByRole('button', { name: 'Color 1' })).toHaveAttribute(
			'aria-pressed',
			'true',
		)
	})

	it('locks the painted tile, disables the used color, and advances the message', async () => {
		const user = userEvent.setup()
		renderWithProvider(<ZenIntro onContinue={vi.fn()} />)

		await placeColor(user, 1)

		expect(screen.getByRole('button', { name: 'Color 1' })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Color 2' })).toBeEnabled()
		expect(
			screen.getByText('Select a new color and add to your design.'),
		).toBeInTheDocument()
		// No color selected again yet, so no tile can be painted.
		expect(
			screen.queryByRole('button', { name: /^Paint tile/ }),
		).not.toBeInTheDocument()

		await placeColor(user, 2)

		expect(
			screen.getByText(
				'Place three more colors, then watch your kaleidoscope come to life!',
			),
		).toBeInTheDocument()
	})

	it('never repaints an already painted tile', async () => {
		const user = userEvent.setup()
		renderWithProvider(<ZenIntro onContinue={vi.fn()} />)

		await placeColor(user, 1)
		await user.click(screen.getByRole('button', { name: 'Color 2' }))

		expect(
			screen.getAllByRole('button', { name: /^Paint tile \d of 6$/ }),
		).toHaveLength(4)
	})

	it('shows congratulations and a Continue button after five tiles, and calls onContinue', async () => {
		const onContinue = vi.fn()
		const user = userEvent.setup()
		renderWithProvider(<ZenIntro onContinue={onContinue} />)

		for (let i = 1; i <= 5; i++) {
			await placeColor(user, i)
		}

		expect(
			screen.getByRole('heading', { name: 'Congratulations!' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('group', { name: 'Current Color Options' }),
		).not.toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'Continue' }))
		expect(onContinue).toHaveBeenCalledTimes(1)
	})

	it('does not save anything to storage', async () => {
		const user = userEvent.setup()
		renderWithProvider(<ZenIntro onContinue={vi.fn()} />)

		await placeColor(user, 1)

		const saved = JSON.parse(
			localStorage.getItem('kaleidoscope:design') ?? '{}',
		)
		expect(saved.shapeGroupColors ?? {}).toEqual({})
	})
})
