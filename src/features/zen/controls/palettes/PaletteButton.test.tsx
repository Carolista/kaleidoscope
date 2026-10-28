import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestZenStateProvider as ZenStateProvider } from '@/test/TestZenStateProvider'
import { palettes, testContent } from '@/test/playerContent'
import type { PlayerContent } from '@/ui/content'
import PaletteButton from './PaletteButton'

const earned: PlayerContent = {
	...testContent,
	palettes: palettes.slice(0, 4),
}

function renderWithLaterReward(ui = <PaletteButton />) {
	let content: PlayerContent = {
		...testContent,
		palettes: palettes.slice(0, 3),
	}
	const wrapper = ({ children }: { children?: React.ReactNode }) => (
		<ZenStateProvider content={content}>{children}</ZenStateProvider>
	)
	const view = render(ui, { wrapper })
	content = earned
	view.rerender(ui)
	return view
}

describe('PaletteButton', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('opens the color palette modal (with the palette picker) and closes it', async () => {
		const user = userEvent.setup()
		render(<PaletteButton />, { wrapper: ZenStateProvider })

		expect(
			screen.queryByRole('dialog', { name: 'Color Palette' }),
		).toBeNull()

		await user.click(
			screen.getByRole('button', {
				name: 'Select a different color palette',
			}),
		)

		expect(
			screen.getByRole('dialog', { name: 'Color Palette' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', {
				name: 'Select the Daytona color palette',
			}),
		).toBeInTheDocument()

		await user.click(
			screen.getByRole('button', {
				name: 'Close color palette selector',
			}),
		)

		await waitFor(() =>
			expect(
				screen.queryByRole('dialog', { name: 'Color Palette' }),
			).not.toBeInTheDocument(),
		)
	})

	it('closes automatically once a palette is selected', async () => {
		const user = userEvent.setup()
		render(<PaletteButton />, { wrapper: ZenStateProvider })

		await user.click(
			screen.getByRole('button', {
				name: 'Select a different color palette',
			}),
		)
		await user.click(
			screen.getByRole('button', {
				name: 'Select the Daytona color palette',
			}),
		)

		await waitFor(() =>
			expect(
				screen.queryByRole('dialog', { name: 'Color Palette' }),
			).not.toBeInTheDocument(),
		)
	})

	it('tags a newly earned palette NEW! once, then not on the next visit', async () => {
		const user = userEvent.setup()
		renderWithLaterReward()
		const open = () =>
			user.click(
				screen.getByRole('button', {
					name: /Select a different color palette/,
				}),
			)
		const close = () =>
			user.click(
				screen.getByRole('button', {
					name: 'Close color palette selector',
				}),
			)

		await open()
		expect(screen.getAllByText('NEW!')).toHaveLength(1)
		expect(
			screen.getByRole('button', {
				name: `Select the ${palettes[3].name} color palette (new)`,
			}),
		).toBeInTheDocument()

		await close()
		await waitFor(() =>
			expect(
				screen.queryByRole('dialog', { name: 'Color Palette' }),
			).not.toBeInTheDocument(),
		)
		await open()
		expect(screen.queryByText('NEW!')).not.toBeInTheDocument()
	})

	it('opens on arrival with the new palette tagged when asked to', async () => {
		localStorage.setItem(
			'kaleidoscope:seen-choices:guest',
			JSON.stringify({
				version: 1,
				palettes: palettes.slice(0, 3).map(palette => palette.id),
				shapes: [],
			}),
		)
		render(<PaletteButton initialOpen />, {
			wrapper: ({ children }) => (
				<ZenStateProvider content={earned}>{children}</ZenStateProvider>
			),
		})

		expect(
			await screen.findByRole('dialog', { name: 'Color Palette' }),
		).toBeInTheDocument()
		expect(screen.getAllByText('NEW!')).toHaveLength(1)
	})
})
