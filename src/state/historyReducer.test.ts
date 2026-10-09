import { describe, expect, it } from 'vitest'
import { colorSchemes } from '../data/colorSchemes'
import type { AppState } from '../types/appState'
import { createInitialHistoryState, historyReducer } from './historyReducer'

function baseState(overrides: Partial<AppState> = {}): AppState {
	return {
		currentScheme: colorSchemes[0],
		currentColor: colorSchemes[0].colors[0],
		darkMode: false,
		showEditableArea: true,
		gridShape: 'hexagon',
		shapeGroupColors: {},
		...overrides,
	}
}

describe('historyReducer', () => {
	it('starts with empty past/future and the given present state', () => {
		const state = baseState()
		const history = createInitialHistoryState(state)
		expect(history.present).toBe(state)
		expect(history.past).toEqual([])
		expect(history.future).toEqual([])
	})

	it('PAINT_SHAPE_GROUP pushes the previous design onto past', () => {
		const state = baseState({ currentColor: '#ff0000' })
		const history = historyReducer(createInitialHistoryState(state), {
			type: 'PAINT_SHAPE_GROUP',
			groupId: '0,0',
		})
		expect(history.present.shapeGroupColors).toEqual({ '0,0': '#ff0000' })
		expect(history.past).toHaveLength(1)
		expect(history.past[0].shapeGroupColors).toEqual({})
	})

	it('UNDO restores the previous design and moves it to future', () => {
		const state = baseState({ currentColor: '#ff0000' })
		let history = createInitialHistoryState(state)
		history = historyReducer(history, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: '0,0',
		})
		history = historyReducer(history, { type: 'UNDO' })

		expect(history.present.shapeGroupColors).toEqual({})
		expect(history.past).toHaveLength(0)
		expect(history.future).toHaveLength(1)
	})

	it('REDO reapplies an undone design and moves it back to past', () => {
		const state = baseState({ currentColor: '#ff0000' })
		let history = createInitialHistoryState(state)
		history = historyReducer(history, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: '0,0',
		})
		history = historyReducer(history, { type: 'UNDO' })
		history = historyReducer(history, { type: 'REDO' })

		expect(history.present.shapeGroupColors).toEqual({ '0,0': '#ff0000' })
		expect(history.past).toHaveLength(1)
		expect(history.future).toHaveLength(0)
	})

	it('UNDO is a no-op when there is nothing to undo', () => {
		const history = createInitialHistoryState(baseState())
		expect(historyReducer(history, { type: 'UNDO' })).toBe(history)
	})

	it('REDO is a no-op when there is nothing to redo', () => {
		const history = createInitialHistoryState(baseState())
		expect(historyReducer(history, { type: 'REDO' })).toBe(history)
	})

	it('a new undoable action after an undo clears the future (no redo branching)', () => {
		const state = baseState({ currentColor: '#ff0000' })
		let history = createInitialHistoryState(state)
		history = historyReducer(history, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: '0,0',
		})
		history = historyReducer(history, { type: 'UNDO' })
		history = historyReducer(history, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: '1,1',
		})

		expect(history.present.shapeGroupColors).toEqual({ '1,1': '#ff0000' })
		expect(history.future).toHaveLength(0)
	})

	it('SELECT_COLOR updates present without touching past/future', () => {
		let history = createInitialHistoryState(baseState())
		history = historyReducer(history, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: '0,0',
		})
		const pastBefore = history.past
		history = historyReducer(history, {
			type: 'SELECT_COLOR',
			color: '#123456',
		})

		expect(history.present.currentColor).toBe('#123456')
		expect(history.past).toBe(pastBefore)
	})

	it('TOGGLE_DARK_MODE updates present without being undoable', () => {
		let history = createInitialHistoryState(baseState({ darkMode: false }))
		history = historyReducer(history, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: '0,0',
		})
		history = historyReducer(history, { type: 'TOGGLE_DARK_MODE' })

		expect(history.present.darkMode).toBe(true)
		expect(history.past).toHaveLength(1)
		expect(history.future).toHaveLength(0)

		history = historyReducer(history, { type: 'UNDO' })
		// Undo steps back through the design, not the dark-mode toggle.
		expect(history.present.darkMode).toBe(true)
		expect(history.present.shapeGroupColors).toEqual({})
	})

	it('RESET_DESIGN is undoable', () => {
		const state = baseState({ shapeGroupColors: { a: '#ff0000' } })
		let history = createInitialHistoryState(state)
		history = historyReducer(history, { type: 'RESET_DESIGN' })
		expect(history.present.shapeGroupColors).toEqual({})

		history = historyReducer(history, { type: 'UNDO' })
		expect(history.present.shapeGroupColors).toEqual({ a: '#ff0000' })
	})

	it('multiple undos/redos walk the full history in order', () => {
		let history = createInitialHistoryState(
			baseState({ currentColor: '#ff0000' }),
		)
		history = historyReducer(history, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: 'a',
		})
		history = historyReducer(history, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: 'b',
		})
		history = historyReducer(history, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: 'c',
		})
		expect(history.present.shapeGroupColors).toEqual({
			a: '#ff0000',
			b: '#ff0000',
			c: '#ff0000',
		})

		history = historyReducer(history, { type: 'UNDO' })
		history = historyReducer(history, { type: 'UNDO' })
		expect(history.present.shapeGroupColors).toEqual({ a: '#ff0000' })

		history = historyReducer(history, { type: 'REDO' })
		expect(history.present.shapeGroupColors).toEqual({
			a: '#ff0000',
			b: '#ff0000',
		})
	})
})
