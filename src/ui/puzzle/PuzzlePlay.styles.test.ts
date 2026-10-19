/// <reference types="node" />
import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const adminCss = readFileSync(
	'src/components/admin/AdminPortal.module.css',
	'utf8',
)
const puzzleCss = readFileSync('src/ui/puzzle/PuzzlePlay.module.css', 'utf8')

it('keeps puzzle pieces independent of opt-in admin control styling', () => {
	const stylesheet = document.createElement('style')
	stylesheet.textContent = `${puzzleCss}\n${adminCss}`
	const page = document.createElement('main')
	page.className = 'page'
	const control = document.createElement('button')
	const playtest = document.createElement('div')
	playtest.className = 'playtest'
	const piece = document.createElement('button')
	piece.className = 'piece'
	playtest.append(piece)
	page.append(control, playtest)
	document.head.append(stylesheet)
	document.body.append(page)
	try {
		expect(getComputedStyle(control).height).not.toBe('2rem')
		expect(adminCss).not.toContain(':not(.playtest *)')
		expect(getComputedStyle(page).getPropertyValue('--button-height')).toBe(
			'2rem',
		)
		const previewStyle = getComputedStyle(piece)
		expect(previewStyle.height).not.toBe('2rem')
		expect(previewStyle.minHeight).toBe('44px')
		expect(previewStyle.aspectRatio).toBe('1 / 1')
		expect(previewStyle.cursor).toBe('grab')
		expect(previewStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)')
	} finally {
		page.remove()
		stylesheet.remove()
	}
})
