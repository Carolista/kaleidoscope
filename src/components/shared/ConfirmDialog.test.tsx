import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProvider } from '@test/renderWithProvider'
import ConfirmDialog from './ConfirmDialog'

describe('ConfirmDialog', () => {
	it('gives each mounted dialog a unique reference to its own heading', () => {
		renderWithProvider(
			<>
				<ConfirmDialog
					open={false}
					title="Confirm Reset"
					message="Reset the design?"
					onConfirm={() => {}}
					onCancel={() => {}}
				/>
				<ConfirmDialog
					open
					title="Confirm Shape Change"
					message="Switch the grid shape?"
					onConfirm={() => {}}
					onCancel={() => {}}
				/>
			</>,
		)

		const dialogs = screen.getAllByRole('dialog', { hidden: true })
		const titleIds = dialogs.map(dialog =>
			dialog.getAttribute('aria-labelledby'),
		)

		expect(dialogs).toHaveLength(2)
		expect(new Set(titleIds).size).toBe(2)

		for (const [index, dialog] of dialogs.entries()) {
			const titleId = titleIds[index]
			if (!titleId) throw new Error('Dialog has no heading reference')
			const heading = document.getElementById(titleId)
			expect(dialog).toContainElement(heading)
			expect(heading).toHaveTextContent(
				index === 0 ? 'Confirm Reset' : 'Confirm Shape Change',
			)
		}

		expect(
			screen.getByRole('dialog', { name: 'Confirm Shape Change' }),
		).toBe(dialogs[1])
	})
})
