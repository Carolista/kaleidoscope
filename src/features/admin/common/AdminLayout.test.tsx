import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import {
	AdminFeedback,
	AdminGallery,
	AdminMemberList,
	AdminMemberRow,
	AdminSectionHeading,
	AdminSelectionBar,
} from './AdminLayout'
import styles from './AdminLayout.module.css'

describe('admin presentation', () => {
	it('keeps section titles and native actions together without owning action state', () => {
		render(
			<section aria-labelledby="title">
				<AdminSectionHeading id="title" title="Palettes">
					<button disabled>Refresh</button>
				</AdminSectionHeading>
				<AdminSectionHeading id="usage" title="Usage" level={3} />
				<AdminFeedback
					error="Could not save."
					status="Palette loaded."
				/>
			</section>,
		)
		const section = screen.getByRole('region', { name: 'Palettes' })
		expect(
			within(section).getByRole('heading', { level: 2 }),
		).toHaveTextContent('Palettes')
		expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
			'Usage',
		)
		expect(screen.getByRole('button')).toBeDisabled()
		expect(screen.getByRole('alert')).toHaveTextContent('Could not save.')
		expect(screen.getByRole('status')).toHaveTextContent('Palette loaded.')
	})

	it('shows the listed total beside a heading only when a count is given', () => {
		const { rerender } = render(
			<AdminSectionHeading id="title" title="Palettes" count={3} />,
		)
		expect(screen.getByText('3 total')).toBeInTheDocument()
		rerender(<AdminSectionHeading id="title" title="Palettes" />)
		expect(screen.queryByText(/total/)).not.toBeInTheDocument()
	})

	it('shows how many cards are selected only once any are checked', () => {
		const props = {
			label: 'Bulk actions',
			shown: 5,
			disabled: false,
			onSelectAll: () => {},
			onClear: () => {},
		}
		const { rerender } = render(
			<AdminSelectionBar {...props} checked={0}>
				<button>Act</button>
			</AdminSelectionBar>,
		)
		expect(screen.queryByText(/selected/)).not.toBeInTheDocument()
		rerender(
			<AdminSelectionBar {...props} checked={2}>
				<button>Act</button>
			</AdminSelectionBar>,
		)
		expect(screen.getByText('2 selected')).toBeInTheDocument()
	})

	it.each(['puzzles', 'palettes', 'groups'] as const)(
		'frames a %s gallery without replacing domain card markup',
		layout => {
			render(
				<AdminGallery layout={layout}>
					<li>
						<strong>Domain card</strong>
						<button>Edit</button>
					</li>
				</AdminGallery>,
			)
			expect(screen.getByRole('list')).toHaveClass(
				styles.gallery,
				styles[layout],
			)
			expect(screen.getByRole('listitem')).toContainElement(
				screen.getByText('Domain card'),
			)
			expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled()
		},
	)

	it('composes ordered member rows with optional previews and domain-specific actions', () => {
		render(
			<AdminMemberList>
				<AdminMemberRow
					preview={<span aria-hidden="true">Preview</span>}
					actions={<button disabled>Move up</button>}
				>
					Puzzle one
				</AdminMemberRow>
				<AdminMemberRow actions={<button>Remove palette</button>}>
					Palette two
				</AdminMemberRow>
			</AdminMemberList>,
		)
		expect(screen.getByRole('list').tagName).toBe('OL')
		expect(screen.getAllByRole('listitem')).toHaveLength(2)
		expect(screen.getByText('Puzzle one')).toHaveClass(styles.memberContent)
		expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Remove palette' }),
		).toBeEnabled()
	})
})
