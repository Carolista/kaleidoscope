import { describe, expect, it, vi } from 'vitest'
import { colorSchemes } from '../data/colorSchemes'
import type { AppState } from '../types/appState'
import type { AppAction } from './appReducer'
import { getGroupIdsForShape } from '../utils/gridShapeRegistry'
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
	const noOpActions: AppAction[] = [
		{ type: 'SELECT_GRID_SHAPE', shape: 'hexagon' },
		{ type: 'RESET_DESIGN' },
		{ type: 'SELECT_SCHEME', scheme: colorSchemes[0] },
		{
			type: 'SELECT_SCHEME',
			scheme: { ...colorSchemes[0], colors: [...colorSchemes[0].colors] },
		},
		{ type: 'SELECT_COLOR', color: colorSchemes[0].colors[0] },
	]

	it.each(noOpActions)(
		'$type leaves empty history unchanged for a no-op',
		action => {
			const history = createInitialHistoryState(baseState())
			expect(historyReducer(history, action)).toBe(history)
		},
	)

	it.each(noOpActions)(
		'$type preserves both history stacks and usable redo for a no-op',
		action => {
			let history = createInitialHistoryState(baseState())
			history = historyReducer(history, {
				type: 'SELECT_GRID_SHAPE',
				shape: 'triangle',
			})
			history = historyReducer(history, {
				type: 'SELECT_GRID_SHAPE',
				shape: 'hexagon',
			})
			history = historyReducer(history, {
				type: 'PAINT_SHAPE_GROUP',
				groupId: 'b',
			})
			history = historyReducer(history, { type: 'UNDO' })
			expect(history.past.length).toBeGreaterThan(0)
			expect(history.future).toHaveLength(1)
			const unchanged = historyReducer(history, action)
			expect(unchanged).toBe(history)
			expect(
				historyReducer(unchanged, { type: 'REDO' }).present
					.shapeGroupColors,
			).toEqual({
				b: colorSchemes[0].colors[0],
			})
		},
	)

	it('reselecting an equivalent scheme resets the selected tool color but preserves history', () => {
		let history = createInitialHistoryState(baseState())
		history = historyReducer(history, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: 'a',
		})
		history = historyReducer(history, { type: 'UNDO' })
		history = historyReducer(history, {
			type: 'SELECT_COLOR',
			color: colorSchemes[0].colors[3],
		})
		const next = historyReducer(history, {
			type: 'SELECT_SCHEME',
			scheme: colorSchemes[0],
		})
		expect(next.present.currentColor).toBe(colorSchemes[0].colors[0])
		expect(next.past).toBe(history.past)
		expect(next.future).toBe(history.future)
		expect(
			historyReducer(next, { type: 'REDO' }).present.shapeGroupColors,
		).toEqual({
			a: colorSchemes[0].colors[0],
		})
	})

	it.each([false, true])(
		'painting accent over default accent preserves redo in dark mode %s',
		darkMode => {
			const accent = darkMode ? '#ffffff' : '#222222'
			let history = createInitialHistoryState(baseState({ darkMode }))
			history = historyReducer(history, {
				type: 'PAINT_SHAPE_GROUP',
				groupId: 'a',
			})
			history = historyReducer(history, { type: 'UNDO' })
			history = historyReducer(history, {
				type: 'SELECT_COLOR',
				color: accent,
			})
			expect(
				historyReducer(history, {
					type: 'PAINT_SHAPE_GROUP',
					groupId: 'a',
				}),
			).toBe(history)
			expect(history.present.shapeGroupColors).toEqual({})
		},
	)

	it('an identical randomized design preserves history regardless of group insertion order', () => {
		const groupIds = getGroupIdsForShape('hexagon')
		const state = baseState({
			shapeGroupColors: Object.fromEntries(
				[...groupIds]
					.reverse()
					.map(id => [id, colorSchemes[0].colors[0]]),
			),
		})
		let history = createInitialHistoryState(state)
		history = historyReducer(history, { type: 'RESET_DESIGN' })
		history = historyReducer(history, { type: 'UNDO' })
		const random = vi.spyOn(Math, 'random').mockReturnValue(0)
		try {
			expect(historyReducer(history, { type: 'RANDOMIZE_DESIGN' })).toBe(
				history,
			)
		} finally {
			random.mockRestore()
		}
		expect(
			historyReducer(history, { type: 'REDO' }).present.shapeGroupColors,
		).toEqual({})
	})

	it.each([
		{ ...colorSchemes[0], name: 'Renamed palette' },
		{ name: colorSchemes[0].name, colors: colorSchemes[1].colors },
	])(
		'records a real scheme change to $name even when one field matches',
		scheme => {
			let history = createInitialHistoryState(baseState())
			history = historyReducer(history, {
				type: 'PAINT_SHAPE_GROUP',
				groupId: 'a',
			})
			history = historyReducer(history, { type: 'UNDO' })
			const next = historyReducer(history, {
				type: 'SELECT_SCHEME',
				scheme,
			})
			expect(next.past).toHaveLength(history.past.length + 1)
			expect(next.future).toEqual([])
			expect(next.present.currentScheme).toBe(scheme)
			const undone = historyReducer(next, { type: 'UNDO' })
			expect(undone.present.currentScheme).toBe(colorSchemes[0])
			expect(
				historyReducer(undone, { type: 'REDO' }).present.currentScheme,
			).toBe(scheme)
		},
	)

	it('a changed randomized design clears redo and remains undoable', () => {
		let history = createInitialHistoryState(baseState())
		history = historyReducer(history, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: 'a',
		})
		history = historyReducer(history, { type: 'UNDO' })
		const random = vi.spyOn(Math, 'random').mockReturnValue(0)
		try {
			const next = historyReducer(history, { type: 'RANDOMIZE_DESIGN' })
			expect(next.past).toHaveLength(1)
			expect(next.future).toEqual([])
			expect(Object.keys(next.present.shapeGroupColors)).toEqual(
				getGroupIdsForShape('hexagon'),
			)
			const undone = historyReducer(next, { type: 'UNDO' })
			expect(undone.present.shapeGroupColors).toEqual({})
			expect(
				historyReducer(undone, { type: 'REDO' }).present
					.shapeGroupColors,
			).toEqual(next.present.shapeGroupColors)
		} finally {
			random.mockRestore()
		}
	})

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

	it('maps the selected palette position on scheme undo and redo', () => {
		const originalScheme = colorSchemes[0]
		const nextScheme = colorSchemes[1]
		let history = createInitialHistoryState(baseState())
		history = historyReducer(history, {
			type: 'SELECT_SCHEME',
			scheme: nextScheme,
		})
		history = historyReducer(history, {
			type: 'SELECT_COLOR',
			color: nextScheme.colors[3],
		})

		expect(history.past).toHaveLength(1)
		history = historyReducer(history, { type: 'UNDO' })
		expect(history.present.currentScheme).toBe(originalScheme)
		expect(history.present.currentColor).toBe(originalScheme.colors[3])

		history = historyReducer(history, { type: 'REDO' })
		expect(history.present.currentScheme).toBe(nextScheme)
		expect(history.present.currentColor).toBe(nextScheme.colors[3])
	})

	it('paints with the reconciled color after undoing a scheme change', () => {
		let history = createInitialHistoryState(baseState())
		history = historyReducer(history, {
			type: 'SELECT_SCHEME',
			scheme: colorSchemes[1],
		})
		history = historyReducer(history, { type: 'UNDO' })
		history = historyReducer(history, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: '0,0',
		})

		expect(history.present.currentColor).toBe(colorSchemes[0].colors[0])
		expect(history.present.shapeGroupColors['0,0']).toBe(
			colorSchemes[0].colors[0],
		)
	})

	it('preserves a selected color already present at another position in the restored palette', () => {
		const originalScheme = colorSchemes[0]
		const nextScheme = {
			name: 'Overlapping palette',
			colors: [
				originalScheme.colors[1],
				originalScheme.colors[2],
				originalScheme.colors[3],
				originalScheme.colors[4],
				originalScheme.colors[0],
			] as const,
		}
		let history = createInitialHistoryState(baseState())
		history = historyReducer(history, {
			type: 'SELECT_SCHEME',
			scheme: nextScheme,
		})
		history = historyReducer(history, { type: 'UNDO' })

		expect(history.present.currentColor).toBe(originalScheme.colors[1])
		history = historyReducer(history, { type: 'REDO' })
		expect(history.present.currentColor).toBe(originalScheme.colors[1])
	})

	it.each([
		[false, '#ffffff'],
		[false, '#222222'],
		[true, '#222222'],
		[true, '#ffffff'],
	])(
		'preserves neutral %s mode color %s across scheme undo and redo',
		(darkMode, color) => {
			let history = createInitialHistoryState(baseState({ darkMode }))
			history = historyReducer(history, {
				type: 'SELECT_SCHEME',
				scheme: colorSchemes[1],
			})
			history = historyReducer(history, {
				type: 'SELECT_COLOR',
				color,
			})
			history = historyReducer(history, { type: 'UNDO' })
			expect(history.present.currentColor).toBe(color)
			expect(history.present.darkMode).toBe(darkMode)
			history = historyReducer(history, { type: 'REDO' })
			expect(history.present.currentColor).toBe(color)
		},
	)

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
