import { fireEvent, render as baseRender, screen } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
	NavigationGuardDialog,
	NavigationGuardProvider,
} from './NavigationGuard'
import useUnsavedDraft from './useUnsavedDraft'
import { useNavigationGuard } from './useNavigationGuard'

function render(ui: ReactElement) {
	return baseRender(ui, {
		wrapper: ({ children }: { children: ReactNode }) => (
			<NavigationGuardProvider>
				{children}
				<NavigationGuardDialog />
			</NavigationGuardProvider>
		),
	})
}

function Editor({
	dirty = false,
	pending = false,
	first,
	second,
}: {
	readonly dirty?: boolean
	readonly pending?: boolean
	readonly first: () => void
	readonly second: () => void
}) {
	useUnsavedDraft({ dirty, pending })
	const { requestNavigation } = useNavigationGuard()
	return (
		<>
			<input aria-label="Draft" defaultValue="Keep this value" />
			<button onClick={() => requestNavigation(first)}>
				First destination
			</button>
			<button onClick={() => requestNavigation(second)}>
				Second destination
			</button>
		</>
	)
}
function unloadIsBlocked() {
	const event = new Event('beforeunload', { cancelable: true })
	window.dispatchEvent(event)
	return event.defaultPrevented
}

describe('shared admin navigation guard', () => {
	it('navigates clean workspaces immediately without a dialog or native unload warning', () => {
		const first = vi.fn()
		render(<Editor first={first} second={vi.fn()} />)
		fireEvent.click(screen.getByText('First destination'))
		expect(first).toHaveBeenCalledOnce()
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(unloadIsBlocked()).toBe(false)
	})

	it('keeps the first intent, preserves data on cancellation, and confirms exactly once', () => {
		const first = vi.fn()
		const second = vi.fn()
		render(<Editor dirty first={first} second={second} />)
		fireEvent.click(screen.getByText('First destination'))
		fireEvent.click(screen.getByText('Second destination'))
		expect(screen.getAllByRole('dialog')).toHaveLength(1)
		expect(unloadIsBlocked()).toBe(true)
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		expect(first).not.toHaveBeenCalled()
		expect(second).not.toHaveBeenCalled()
		expect(screen.getByLabelText('Draft')).toHaveValue('Keep this value')
		fireEvent.click(screen.getByText('First destination'))
		fireEvent.click(screen.getByText('Second destination'))
		const confirm = screen.getByRole('button', { name: 'Discard changes' })
		fireEvent.click(confirm)
		fireEvent.click(confirm)
		expect(first).toHaveBeenCalledOnce()
		expect(second).not.toHaveBeenCalled()
	})

	it('blocks in-flight operations without offering discard or queuing a later navigation', () => {
		const first = vi.fn()
		const second = vi.fn()
		const { rerender } = render(
			<Editor dirty pending first={first} second={second} />,
		)
		fireEvent.click(screen.getByText('First destination'))
		expect(
			screen.getByRole('dialog', { name: 'Operation in progress' }),
		).toHaveTextContent('would not cancel')
		expect(
			screen.queryByRole('button', { name: 'Discard changes' }),
		).not.toBeInTheDocument()
		expect(unloadIsBlocked()).toBe(true)
		rerender(<Editor first={first} second={second} />)
		fireEvent.click(screen.getByText('Second destination'))
		fireEvent.click(screen.getByRole('button', { name: 'Stay here' }))
		expect(first).not.toHaveBeenCalled()
		expect(second).not.toHaveBeenCalled()
		expect(unloadIsBlocked()).toBe(false)
		fireEvent.click(screen.getByText('Second destination'))
		expect(second).toHaveBeenCalledOnce()
	})

	it('rechecks pending work before honoring an already-open discard decision', () => {
		const first = vi.fn()
		const second = vi.fn()
		const { rerender } = render(
			<Editor dirty first={first} second={second} />,
		)
		fireEvent.click(screen.getByText('First destination'))
		rerender(<Editor dirty pending first={first} second={second} />)
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		expect(
			screen.getByRole('dialog', { name: 'Operation in progress' }),
		).toBeInTheDocument()
		expect(first).not.toHaveBeenCalled()
	})

	it('registers independent sources without a clean sibling clearing protection and cleans up on unmount', () => {
		const first = vi.fn()
		const { rerender, unmount } = render(
			<>
				<Editor dirty first={first} second={vi.fn()} />
				<Editor first={first} second={vi.fn()} />
			</>,
		)
		expect(unloadIsBlocked()).toBe(true)
		rerender(<Editor first={first} second={vi.fn()} />)
		expect(unloadIsBlocked()).toBe(false)
		unmount()
		expect(unloadIsBlocked()).toBe(false)
	})
})
