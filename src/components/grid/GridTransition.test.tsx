import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GridTransition from './GridTransition'
import { supportedGridShapes } from '@/data/gridShapes'
import { availableGridSizes } from '@/data/gridSizes'
import { computeAspectRatioForShape } from '@/shape-geometry/gridShapeRegistry'

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

		expect(animations).toHaveLength(2)
		animations[0].onfinish?.()
		expect(stage.children).toHaveLength(1)
		expect(stage.firstElementChild).toHaveTextContent('new grid')
	})

	it('reserves the same tallest-grid aspect ratio across replacements', () => {
		const { rerender, container } = render(
			<GridTransition gridKey="triangle:sm">
				<p>triangle</p>
			</GridTransition>,
		)
		const stage = container.firstElementChild as HTMLElement
		const ratio = Number(
			stage.style.getPropertyValue('--stage-aspect-ratio'),
		)
		const ratios = supportedGridShapes.flatMap(({ id }) =>
			availableGridSizes[id].map(size =>
				computeAspectRatioForShape(id, size),
			),
		)
		expect(ratio).toBe(Math.min(...ratios))
		expect(ratio).toBeCloseTo(Math.sqrt(3) / 2, 12)
		rerender(
			<GridTransition gridKey="hexagram:lg">
				<p>hexagram</p>
			</GridTransition>,
		)
		expect(
			Number(stage.style.getPropertyValue('--stage-aspect-ratio')),
		).toBe(ratio)
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
