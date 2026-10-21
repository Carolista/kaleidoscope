/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('shares cell grout, transitions and dimming while keeping polygon joins local', () => {
	const sheet = document.createElement('style')
	sheet.textContent =
		readFileSync('src/features/zen/grid/Cell.module.css', 'utf8') +
		readFileSync(
			'src/features/zen/grid/PolygonCell.module.css',
			'utf8',
		).replaceAll('.cell', '.polygon')
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
	const polygon = document.createElementNS(svg.namespaceURI, 'polygon')
	const circle = document.createElementNS(svg.namespaceURI, 'circle')
	polygon.setAttribute('class', 'cell clickable dimmed polygon')
	circle.setAttribute('class', 'cell clickable dimmed')
	svg.append(polygon, circle)
	document.head.append(sheet)
	document.body.append(svg)
	try {
		for (const cell of [polygon, circle]) {
			const style = getComputedStyle(cell)
			expect(style.strokeWidth).toBe('1')
			expect(style.transition).toContain('fill 0.1s ease')
			expect(style.cursor).toBe('pointer')
			expect(style.opacity).toBe('0.2')
		}
		expect(getComputedStyle(polygon).strokeLinejoin).toBe('round')
		expect(getComputedStyle(circle).strokeLinejoin).not.toBe('round')
	} finally {
		svg.remove()
		sheet.remove()
	}
})

it('visually clips accessible text without hiding it from assistive technology', () => {
	const sheet = document.createElement('style')
	sheet.textContent = readFileSync('src/app/index.css', 'utf8')
	const status = document.createElement('p')
	status.className = 'visually-hidden'
	status.setAttribute('role', 'status')
	status.textContent = 'Painted tile.'
	document.head.append(sheet)
	document.body.append(status)
	try {
		const style = getComputedStyle(status)
		expect(style.position).toBe('absolute')
		expect(style.width).toBe('1px')
		expect(style.height).toBe('1px')
		expect(style.clipPath).toBe('inset(50%)')
		expect(style.overflow).toBe('hidden')
		expect(style.display).not.toBe('none')
		expect(style.visibility).not.toBe('hidden')
		expect(status).not.toHaveAttribute('aria-hidden')
	} finally {
		status.remove()
		sheet.remove()
	}
})
