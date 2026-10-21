import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { palettes } from '@/domain/palettes'
import { renderWithProvider } from '@/test/renderWithProvider'
import IntroSequence from './IntroSequence'

const FIRST_PALETTE_COLORS = palettes[0].colors

async function placeColor(
	user: ReturnType<typeof userEvent.setup>,
	colorNumber: number,
	tileNumber: number,
) {
	await user.click(
		screen.getByRole('button', { name: `Color ${colorNumber}` }),
	)
	await user.click(
		screen.getByRole('button', { name: `Paint tile ${tileNumber} of 5` }),
	)
}

describe('IntroSequence', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('starts with the welcome message, the first palette, and no paintable tiles', () => {
		renderWithProvider(<IntroSequence onContinue={vi.fn()} />)

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

	it('offers exactly five paintable tiles once a color is chosen', async () => {
		const user = userEvent.setup()
		renderWithProvider(<IntroSequence onContinue={vi.fn()} />)

		await user.click(screen.getByRole('button', { name: 'Color 1' }))

		expect(
			screen.getAllByRole('button', { name: /^Paint tile \d of 5$/ }),
		).toHaveLength(5)
		expect(screen.getByRole('button', { name: 'Color 1' })).toHaveAttribute(
			'aria-pressed',
			'true',
		)
	})

	it('locks the painted tile, disables the used color, and advances the message', async () => {
		const user = userEvent.setup()
		renderWithProvider(<IntroSequence onContinue={vi.fn()} />)

		await placeColor(user, 1, 1)

		expect(screen.getByRole('button', { name: 'Color 1' })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Color 2' })).toBeEnabled()
		expect(
			screen.getByText('Select a new color and add to your design.'),
		).toBeInTheDocument()
		// No color selected again yet, so no tile can be painted.
		expect(
			screen.queryByRole('button', { name: /^Paint tile/ }),
		).not.toBeInTheDocument()

		await placeColor(user, 2, 2)

		expect(
			screen.getByText(
				'Place three more colors, then watch your kaleidoscope come to life!',
			),
		).toBeInTheDocument()
	})

	it('never repaints an already painted tile', async () => {
		const user = userEvent.setup()
		renderWithProvider(<IntroSequence onContinue={vi.fn()} />)

		await placeColor(user, 1, 1)
		await user.click(screen.getByRole('button', { name: 'Color 2' }))

		expect(
			screen.getAllByRole('button', { name: /^Paint tile \d of 5$/ }),
		).toHaveLength(4)
	})

	it('shows congratulations and a Continue button after five tiles, and calls onContinue', async () => {
		const onContinue = vi.fn()
		const user = userEvent.setup()
		renderWithProvider(<IntroSequence onContinue={onContinue} />)

		for (let i = 1; i <= 5; i++) {
			await placeColor(user, i, i)
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
		renderWithProvider(<IntroSequence onContinue={vi.fn()} />)

		await placeColor(user, 1, 1)

		const saved = JSON.parse(
			localStorage.getItem('kaleidoscope:design') ?? '{}',
		)
		expect(saved.shapeGroupColors ?? {}).toEqual({})
	})
})
