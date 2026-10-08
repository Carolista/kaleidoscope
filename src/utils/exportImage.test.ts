import { describe, expect, it } from 'vitest'
import { buildExportFilename, buildExportClone } from './exportImage'

describe('buildExportFilename', () => {
	it('formats the date into a sortable timestamped filename', () => {
		const date = new Date(2024, 2, 5, 9, 7, 3)
		expect(buildExportFilename(date)).toBe(
			'kaleidoscope-20240305-090703.png',
		)
	})

	it('zero-pads single-digit month, day, hour, minute, and second', () => {
		const date = new Date(2024, 0, 1, 0, 0, 0)
		expect(buildExportFilename(date)).toBe(
			'kaleidoscope-20240101-000000.png',
		)
	})

	it('defaults to the current date when none is provided', () => {
		expect(buildExportFilename()).toMatch(/^kaleidoscope-\d{8}-\d{6}\.png$/)
	})
})

describe('buildExportClone', () => {
	function buildSvgWithDimmedPolygon(): SVGSVGElement {
		const svgNS = 'http://www.w3.org/2000/svg'
		const svg = document.createElementNS(svgNS, 'svg') as SVGSVGElement
		const polygon = document.createElementNS(
			svgNS,
			'polygon',
		) as SVGPolygonElement
		polygon.setAttribute('points', '0,0 1,0 1,1')
		// Mimics the on-screen "dimmed" treatment the editable-wedge
		// highlight applies (hover, or the touch toggle's persistent state).
		polygon.style.opacity = '0.2'
		svg.appendChild(polygon)
		document.body.appendChild(svg)
		return svg
	}

	it('forces every polygon fully opaque, regardless of a dimmed on-screen style', () => {
		const svg = buildSvgWithDimmedPolygon()
		const clone = buildExportClone(svg, 100, 100)
		const polygon = clone.querySelector('polygon') as SVGPolygonElement
		expect(polygon.style.opacity).toBe('1')
	})

	it('sets the requested width and height on the clone', () => {
		const svg = buildSvgWithDimmedPolygon()
		const clone = buildExportClone(svg, 320, 240)
		expect(clone.getAttribute('width')).toBe('320')
		expect(clone.getAttribute('height')).toBe('240')
	})

	it('leaves the live SVG untouched', () => {
		const svg = buildSvgWithDimmedPolygon()
		buildExportClone(svg, 100, 100)
		const livePolygon = svg.querySelector('polygon') as SVGPolygonElement
		expect(livePolygon.style.opacity).toBe('0.2')
	})
})
