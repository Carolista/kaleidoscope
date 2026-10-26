import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	markEntranceSpinFinished,
	markEntranceStarted,
	readEntranceHandoff,
	resetEntranceHandoff,
} from './entranceHandoff'

afterEach(() => {
	resetEntranceHandoff()
	vi.restoreAllMocks()
})

describe('entrance handoff', () => {
	it('has nothing to continue when no opening was shown', () => {
		expect(readEntranceHandoff()).toEqual({
			settled: false,
			spinDone: false,
			elapsedMs: 0,
			moveElapsedMs: 0,
		})
	})

	it('reports how far an opening in progress has got', () => {
		const now = vi.spyOn(performance, 'now')
		now.mockReturnValue(1000)
		markEntranceStarted()
		now.mockReturnValue(1600)
		expect(readEntranceHandoff()).toEqual({
			settled: false,
			spinDone: false,
			elapsedMs: 600,
			moveElapsedMs: 0,
		})
	})

	it('keeps the first start when asked again', () => {
		const now = vi.spyOn(performance, 'now')
		now.mockReturnValue(100)
		markEntranceStarted()
		now.mockReturnValue(900)
		markEntranceStarted()
		now.mockReturnValue(1000)
		expect(readEntranceHandoff().elapsedMs).toBe(900)
	})

	it('follows the title once the spin has finished, or its time has passed', () => {
		const now = vi.spyOn(performance, 'now')
		now.mockReturnValue(0)
		markEntranceStarted()
		now.mockReturnValue(1500)
		markEntranceSpinFinished()
		now.mockReturnValue(1900)
		expect(readEntranceHandoff()).toMatchObject({
			spinDone: true,
			settled: false,
			moveElapsedMs: 400,
		})
		now.mockReturnValue(2900)
		expect(readEntranceHandoff().settled).toBe(true)
		resetEntranceHandoff()
		now.mockReturnValue(0)
		markEntranceStarted()
		now.mockReturnValue(2500)
		expect(readEntranceHandoff()).toMatchObject({
			spinDone: true,
			settled: false,
			moveElapsedMs: 500,
		})
		now.mockReturnValue(3400)
		expect(readEntranceHandoff().settled).toBe(true)
	})
})
