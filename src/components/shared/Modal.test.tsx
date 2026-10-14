import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from './Modal'
import styles from './Modal.module.css'

describe('Modal', () => {
	it('synchronizes native open state with its controlled prop and labels its content', () => {
		const onClose = vi.fn()
		const content = <h2 id="modal-title">Test modal</h2>
		const { rerender } = render(
			<Modal open={false} onClose={onClose} labelledBy="modal-title">
				{content}
			</Modal>,
		)
		const dialog = screen.getByRole('dialog', { hidden: true })
		expect(dialog).not.toHaveAttribute('open')
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		rerender(
			<Modal open onClose={onClose} labelledBy="modal-title">
				{content}
			</Modal>,
		)
		expect(screen.getByRole('dialog', { name: 'Test modal' })).toBe(dialog)
		expect(dialog).toHaveAttribute('open')
		expect(dialog).toContainElement(
			screen.getByRole('heading', { name: 'Test modal' }),
		)
		rerender(
			<Modal open={false} onClose={onClose} labelledBy="modal-title">
				{content}
			</Modal>,
		)
		expect(dialog).not.toHaveAttribute('open')
		expect(onClose).not.toHaveBeenCalled()
	})

	it('requests dismissal on native cancel but leaves closing to the parent', () => {
		const onClose = vi.fn()
		render(
			<Modal open onClose={onClose} labelledBy="modal-title">
				<h2 id="modal-title">Test modal</h2>
			</Modal>,
		)
		const dialog = screen.getByRole('dialog')
		// jsdom does not translate Escape into the native dialog cancel event.
		const cancel = new Event('cancel', { cancelable: true })
		fireEvent(dialog, cancel)
		expect(cancel.defaultPrevented).toBe(true)
		expect(onClose).toHaveBeenCalledTimes(1)
		expect(dialog).toHaveAttribute('open')
	})

	it('dismisses only on a direct backdrop click, not a content click', async () => {
		const onClose = vi.fn()
		const user = userEvent.setup()
		render(
			<Modal open onClose={onClose} labelledBy="modal-title">
				<div>
					<h2 id="modal-title">Test modal</h2>
					<button>Content action</button>
				</div>
			</Modal>,
		)
		await user.click(screen.getByRole('heading'))
		await user.click(screen.getByRole('button', { name: 'Content action' }))
		expect(onClose).not.toHaveBeenCalled()
		await user.click(screen.getByRole('dialog'))
		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it('keeps its header outside the scrolling content', () => {
		const { container } = render(
			<Modal
				open
				onClose={vi.fn()}
				labelledBy="title"
				header={<h2 id="title">Fixed header</h2>}
			>
				<p>Scrollable content</p>
			</Modal>,
		)
		const scroller = container.querySelector(`.${styles.scroller}`)!
		expect(scroller).toContainElement(
			screen.getByText('Scrollable content'),
		)
		expect(scroller).not.toContainElement(screen.getByRole('heading'))
	})

	it('locks the page until the last modal closes and restores its styles and scroll position', () => {
		const originalOverflow = document.body.style.overflow
		document.body.style.overflow = 'auto'
		const scroll = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(125)
		const first = render(
			<Modal open onClose={vi.fn()} labelledBy="first">
				<h2 id="first">First</h2>
			</Modal>,
		)
		expect(document.body.style.position).toBe('fixed')
		expect(document.body.style.top).toBe('-125px')
		expect(document.documentElement.style.overflow).toBe('hidden')
		const second = render(
			<Modal open onClose={vi.fn()} labelledBy="second">
				<h2 id="second">Second</h2>
			</Modal>,
		)
		second.unmount()
		expect(document.body.style.position).toBe('fixed')
		first.unmount()
		expect(document.body.style.position).toBe('')
		expect(document.body.style.overflow).toBe('auto')
		expect(document.documentElement.style.overflow).toBe('')
		expect(window.scrollTo).toHaveBeenLastCalledWith({
			left: 0,
			top: 125,
			behavior: 'instant',
		})
		document.body.style.overflow = originalOverflow
		scroll.mockRestore()
	})

	it('shows only the edges with more content and updates when content resizes', () => {
		let resized = () => {}
		const observe = vi.spyOn(ResizeObserver.prototype, 'observe')
		const NativeObserver = ResizeObserver
		vi.stubGlobal(
			'ResizeObserver',
			class extends NativeObserver {
				constructor(callback: () => void) {
					super(callback)
					resized = callback
				}
			},
		)
		const { container, unmount } = render(
			<Modal open onClose={vi.fn()} labelledBy="title">
				<h2 id="title">Overflow</h2>
			</Modal>,
		)
		const scroller = container.querySelector(`.${styles.scroller}`)!
		Object.defineProperties(scroller, {
			clientHeight: { configurable: true, value: 100 },
			scrollHeight: { configurable: true, value: 300 },
		})
		act(resized)
		expect(observe).toHaveBeenCalledTimes(2)
		expect(container.querySelector(`.${styles.topEdge}`)).toBeNull()
		expect(
			container.querySelector(`.${styles.bottomEdge}`),
		).toHaveAttribute('aria-hidden', 'true')
		expect(scroller).toHaveAttribute('tabindex', '0')
		scroller.scrollTop = 100
		fireEvent.scroll(scroller)
		expect(
			container.querySelector(`.${styles.topEdge}`),
		).toBeInTheDocument()
		expect(
			container.querySelector(`.${styles.bottomEdge}`),
		).toBeInTheDocument()
		scroller.scrollTop = 200
		fireEvent.scroll(scroller)
		expect(container.querySelector(`.${styles.bottomEdge}`)).toBeNull()
		scroller.scrollTop = 0
		Object.defineProperty(scroller, 'scrollHeight', { value: 100 })
		act(resized)
		expect(container.querySelector(`.${styles.topEdge}`)).toBeNull()
		expect(container.querySelector(`.${styles.bottomEdge}`)).toBeNull()
		expect(scroller).toHaveAttribute('tabindex', '-1')
		unmount()
		observe.mockRestore()
		vi.unstubAllGlobals()
	})
})
