import { afterAll, beforeEach, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

// jsdom has no layout, so drag tests choose the element under the pointer.
export const hitTest = vi.fn<(x: number, y: number) => Element | null>()

// Call inside a describe block that renders a puzzle.
export function stubPointerHitTesting() {
	const originalHitTest = Object.getOwnPropertyDescriptor(
		document,
		'elementFromPoint',
	)
	const originalCapture = Object.getOwnPropertyDescriptor(
		Element.prototype,
		'setPointerCapture',
	)
	beforeEach(() => {
		hitTest.mockReset().mockReturnValue(null)
		Object.defineProperty(document, 'elementFromPoint', {
			configurable: true,
			value: hitTest,
		})
		Object.defineProperty(Element.prototype, 'setPointerCapture', {
			configurable: true,
			value: vi.fn(),
		})
	})
	afterAll(() => {
		if (originalHitTest)
			Object.defineProperty(document, 'elementFromPoint', originalHitTest)
		else Reflect.deleteProperty(document, 'elementFromPoint')
		if (originalCapture)
			Object.defineProperty(
				Element.prototype,
				'setPointerCapture',
				originalCapture,
			)
		else Reflect.deleteProperty(Element.prototype, 'setPointerCapture')
	})
}

// Players who finished the tutorials go straight to the puzzles.
export function markPuzzleIntrosSeen() {
	localStorage.setItem(
		'kaleidoscope:puzzle-intro',
		JSON.stringify({ version: 1, seen: ['basic', 'rotation'] }),
	)
}

export function tileAt(key: string) {
	const tile = screen
		.getByRole('group', { name: 'Puzzle board' })
		.querySelector<SVGPolygonElement>(`[data-puzzle-cell="${key}"]`)
	if (!tile) throw new Error(`Missing puzzle tile ${key}`)
	return tile
}

export function pieceButton(index: number) {
	return screen.getByRole('button', {
		name: new RegExp(`^Select piece ${index + 1},`),
	})
}

export function dragTo(
	source: Element,
	destination: Element | null,
	pointerType = 'mouse',
) {
	hitTest.mockReturnValue(destination)
	fireEvent.pointerDown(source, {
		pointerId: 1,
		button: 0,
		clientX: 10,
		clientY: 10,
		pointerType,
	})
	fireEvent.pointerMove(source, {
		pointerId: 1,
		clientX: 100,
		clientY: 100,
		pointerType,
	})
	fireEvent.pointerUp(source, {
		pointerId: 1,
		clientX: 100,
		clientY: 100,
		pointerType,
	})
}
