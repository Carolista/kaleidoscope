import { describe, expect, it } from 'vitest'
import { buildExportFilename } from './exportImage'

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
