import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GridTransition from './GridTransition'

type FakeAnimation = { cancel: () => void; onfinish: (() => void) | null }

describe('GridTransition', () => {
	const animations: FakeAnimation[] = []
	const originalAnimate = Element.prototype.animate

	beforeEach(() => {
		animations.length = 0
		Element.prototype.animate = vi.fn(() => {
			const animation: FakeAnimation = { cancel: vi.fn(), onfinish: null }
			animations.push(animation)
			return animation as unknown as Animation
		})
	})

	afterEach(() => {
		Element.prototype.animate = originalAnimate
		vi.unstubAllGlobals()
	})

	it('does not animate on first render', () => {
		render(
			<GridTransition gridKey="hexagon:md">
				<p>first</p>
			</GridTransition>,
		)
		expect(Element.prototype.animate).not.toHaveBeenCalled()
	})

	it('does not animate when the key is unchanged', () => {
		const { rerender } = render(
			<GridTransition gridKey="hexagon:md">
				<p>first</p>
			</GridTransition>,
		)
		rerender(
			<GridTransition gridKey="hexagon:md">
				<p>first</p>
			</GridTransition>,
		)
		expect(Element.prototype.animate).not.toHaveBeenCalled()
	})

	it('shrinks an inert copy of the old grid, then removes it', () => {
		const { rerender, container } = render(
			<GridTransition gridKey="hexagon:md">
				<p>old grid</p>
			</GridTransition>,
		)
		rerender(
			<GridTransition gridKey="triangle:md">
				<p>new grid</p>
			</GridTransition>,
		)

		const stage = container.firstElementChild as HTMLElement
		expect(stage.children).toHaveLength(2)
		const clone = stage.children[1] as HTMLElement
		expect(clone).toHaveTextContent('old grid')
		expect(clone).toHaveAttribute('aria-hidden', 'true')
		expect(clone.inert).toBe(true)
		expect(screen.getByText('new grid')).toBeInTheDocument()

		// exit, enter, and the height easing
		expect(animations).toHaveLength(3)
		animations[0].onfinish?.()
		expect(stage.children).toHaveLength(1)
		expect(stage.firstElementChild).toHaveTextContent('new grid')
	})

	it('drops a pending copy when replaced again mid-transition', () => {
		const { rerender, container } = render(
			<GridTransition gridKey="a">
				<p>a</p>
			</GridTransition>,
		)
		rerender(
			<GridTransition gridKey="b">
				<p>b</p>
			</GridTransition>,
		)
		rerender(
			<GridTransition gridKey="c">
				<p>c</p>
			</GridTransition>,
		)

		const stage = container.firstElementChild as HTMLElement
		expect(stage.children).toHaveLength(2)
		expect(stage.children[1]).toHaveTextContent('b')
		expect(animations[0].cancel).toHaveBeenCalled()
	})

	it('swaps instantly when the user prefers reduced motion', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: true }))
		const { rerender, container } = render(
			<GridTransition gridKey="a">
				<p>a</p>
			</GridTransition>,
		)
		rerender(
			<GridTransition gridKey="b">
				<p>b</p>
			</GridTransition>,
		)
		expect(Element.prototype.animate).not.toHaveBeenCalled()
		expect(container.firstElementChild?.children).toHaveLength(1)
	})
})
