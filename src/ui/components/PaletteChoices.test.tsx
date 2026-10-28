import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PaletteChoices from './PaletteChoices'
import PaletteStrip from './PaletteStrip'
import styles from './PaletteStrip.module.css'

const palettes = [
	{
		id: 'first',
		name: 'Same name',
		colors: ['#112233', '#445566', '#112233'],
	},
	{ id: 'second', name: 'Same name', colors: ['#aabbcc', '#ddeeff'] },
] as const

describe('palette presentation', () => {
	it.each(['swatches', 'continuous'] as const)(
		'preserves ordered duplicate color slots in a decorative %s strip',
		variant => {
			const { container } = render(
				<PaletteStrip colors={palettes[0].colors} variant={variant} />,
			)
			const strip = container.firstElementChild!
			expect(strip).toHaveAttribute('aria-hidden', 'true')
			expect(strip).toHaveClass(styles[variant])
			expect(strip.children).toHaveLength(3)
			for (const [index, color] of palettes[0].colors.entries()) {
				expect(strip.children[index]).toHaveStyle({
					backgroundColor: color,
				})
			}
			expect(screen.queryByRole('button')).not.toBeInTheDocument()
		},
	)

	it('tags only the new palettes with NEW! and mentions it in their name', () => {
		render(
			<PaletteChoices
				palettes={palettes}
				onSelect={vi.fn()}
				newIds={new Set(['second'])}
			/>,
		)
		const [first, second] = screen.getAllByRole('button')
		expect(within(first).queryByText('NEW!')).not.toBeInTheDocument()
		expect(within(second).getByText('NEW!')).toBeInTheDocument()
		expect(first).toHaveAccessibleName('Select the Same name color palette')
		expect(second).toHaveAccessibleName(
			'Select the Same name color palette (new)',
		)
	})

	it('can disable individual choices while the rest stay selectable', async () => {
		const user = userEvent.setup()
		const onSelect = vi.fn()
		render(
			<PaletteChoices
				palettes={palettes}
				onSelect={onSelect}
				isDisabled={palette => palette.id === 'first'}
			/>,
		)
		const [first, second] = screen.getAllByRole('button')
		expect(first).toBeDisabled()
		expect(second).toBeEnabled()
		await user.click(first)
		expect(onSelect).not.toHaveBeenCalled()
		await user.click(second)
		expect(onSelect).toHaveBeenCalledExactlyOnceWith('second')
	})

	it('uses IDs for controlled selection even with duplicate names and reordered options', async () => {
		const user = userEvent.setup()
		const onSelect = vi.fn()
		const submit = vi.fn(event => event.preventDefault())
		const { rerender } = render(
			<form onSubmit={submit}>
				<PaletteChoices
					palettes={palettes}
					selectedId="first"
					onSelect={onSelect}
				/>
			</form>,
		)
		const [first, second] = screen.getAllByRole('button')
		expect(first).toHaveAttribute('aria-pressed', 'true')
		expect(second).toHaveAttribute('aria-pressed', 'false')
		expect(first).toHaveAttribute('type', 'button')
		expect(first).toHaveAttribute('title', 'Same name')
		expect(first).toHaveAccessibleName('Select the Same name color palette')
		expect(within(first).queryByText('Same name')).not.toBeInTheDocument()
		await user.click(second)
		expect(onSelect).toHaveBeenCalledExactlyOnceWith('second')
		expect(submit).not.toHaveBeenCalled()
		expect(first).toHaveAttribute('aria-pressed', 'true')
		rerender(
			<PaletteChoices
				palettes={[...palettes].reverse()}
				selectedId="second"
				onSelect={onSelect}
				showNames
			/>,
		)
		expect(screen.getAllByRole('button')[0]).toHaveAttribute(
			'aria-pressed',
			'true',
		)
		expect(screen.getAllByText('Same name')).toHaveLength(2)
	})

	it('supports custom action labels and keyboard selection without a provider', async () => {
		const user = userEvent.setup()
		const onSelect = vi.fn()
		render(
			<PaletteChoices
				palettes={palettes.slice(0, 1)}
				onSelect={onSelect}
				label={palette => `Apply ${palette.name} to selected drafts`}
				showNames
			/>,
		)
		const button = screen.getByRole('button', {
			name: 'Apply Same name to selected drafts',
		})
		await user.tab()
		expect(button).toHaveFocus()
		await user.keyboard(' ')
		expect(onSelect).toHaveBeenCalledExactlyOnceWith('first')
	})

	it.each([true, false])(
		'respects explicit or fieldset disabled state (explicit: %s)',
		async explicit => {
			const onSelect = vi.fn()
			const user = userEvent.setup()
			render(
				<fieldset disabled={!explicit}>
					<PaletteChoices
						palettes={palettes}
						disabled={explicit}
						onSelect={onSelect}
					/>
				</fieldset>,
			)
			for (const button of screen.getAllByRole('button')) {
				expect(button).toBeDisabled()
				await user.click(button)
			}
			expect(onSelect).not.toHaveBeenCalled()
		},
	)
})
