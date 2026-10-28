import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { usePressPreview } from './usePressPreview'

function Target() {
	const press = usePressPreview()
	return (
		<button type="button" {...press}>
			target
		</button>
	)
}

describe('usePressPreview', () => {
	it('previews while a finger is held and ends on release', () => {
		render(<Target />)
		const target = screen.getByRole('button')
		fireEvent.pointerDown(target, { pointerType: 'touch' })
		expect(target).toHaveAttribute('data-previewing', 'true')
		fireEvent.pointerUp(target, { pointerType: 'touch' })
		expect(target).not.toHaveAttribute('data-previewing')
	})

	it('ends when the browser cancels the press, such as when a scroll begins', () => {
		render(<Target />)
		const target = screen.getByRole('button')
		fireEvent.pointerDown(target, { pointerType: 'touch' })
		fireEvent.pointerCancel(target, { pointerType: 'touch' })
		expect(target).not.toHaveAttribute('data-previewing')
	})

	it('leaves the mouse to CSS hover', () => {
		render(<Target />)
		const target = screen.getByRole('button')
		fireEvent.pointerDown(target, { pointerType: 'mouse' })
		expect(target).not.toHaveAttribute('data-previewing')
	})

	it('suppresses the long-press context menu', () => {
		render(<Target />)
		expect(fireEvent.contextMenu(screen.getByRole('button'))).toBe(false)
	})
})
