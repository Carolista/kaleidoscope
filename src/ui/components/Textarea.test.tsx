import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Textarea } from './FormControl'

const LINE = 20

// jsdom does no layout, so the height of the text is worked out from its line count.
beforeEach(() => {
	vi.spyOn(
		HTMLTextAreaElement.prototype,
		'scrollHeight',
		'get',
	).mockImplementation(function (this: HTMLTextAreaElement) {
		return Math.max(1, this.value.split('\n').length) * LINE
	})
})
afterEach(() => vi.restoreAllMocks())

describe('Textarea', () => {
	it('grows and shrinks with what is typed', async () => {
		render(<Textarea aria-label="Notes" />)
		const notes = screen.getByLabelText('Notes')
		expect(notes).toHaveStyle({ height: `${LINE}px` })
		await userEvent.type(notes, 'one{Enter}two{Enter}three')
		expect(notes).toHaveStyle({ height: `${3 * LINE}px` })
		await userEvent.clear(notes)
		expect(notes).toHaveStyle({ height: `${LINE}px` })
	})

	it('fits text it starts with', () => {
		render(<Textarea aria-label="Notes" defaultValue={'a\nb\nc\nd'} />)
		expect(screen.getByLabelText('Notes')).toHaveStyle({
			height: `${4 * LINE}px`,
		})
	})

	it('follows a value set from outside', () => {
		const { rerender } = render(
			<Textarea
				aria-label="Notes"
				value="a"
				onChange={() => undefined}
			/>,
		)
		rerender(
			<Textarea
				aria-label="Notes"
				value={'a\nb'}
				onChange={() => undefined}
			/>,
		)
		expect(screen.getByLabelText('Notes')).toHaveStyle({
			height: `${2 * LINE}px`,
		})
	})

	it('can keep a fixed height instead', async () => {
		render(<Textarea aria-label="Notes" autoGrow={false} />)
		const notes = screen.getByLabelText('Notes')
		await userEvent.type(notes, 'one{Enter}two{Enter}three')
		expect(notes.style.height).toBe('')
	})

	it('still passes on its own input handler and ref', async () => {
		const onInput = vi.fn()
		const ref = vi.fn()
		render(<Textarea aria-label="Notes" onInput={onInput} ref={ref} />)
		await userEvent.type(screen.getByLabelText('Notes'), 'x')
		expect(onInput).toHaveBeenCalled()
		expect(ref).toHaveBeenCalledWith(screen.getByLabelText('Notes'))
	})
})
