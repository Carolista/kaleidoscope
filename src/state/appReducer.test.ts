import { describe, expect, it } from 'vitest'
import { colorSchemes } from '../data/colorSchemes'
import {
	appReducer,
	createInitialAppState,
	pickRandomScheme,
} from './appReducer'
import type { AppState } from '../types/appState'

describe('createInitialAppState / pickRandomScheme', () => {
	it('picks a scheme from the known list and defaults current color to its first color', () => {
		const state = createInitialAppState()
		expect(colorSchemes).toContain(state.currentScheme)
		expect(state.currentColor).toBe(state.currentScheme.colors[0])
		expect(state.darkMode).toBe(true)
		expect(state.showEditableArea).toBe(true)
		expect(state.gridShape).toBe('hexagon')
		expect(state.shapeGroupColors).toEqual({})
	})

	it('pickRandomScheme always returns one of the known schemes', () => {
		for (let i = 0; i < 20; i++) {
			expect(colorSchemes).toContain(pickRandomScheme())
		}
	})
})

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

describe('appReducer', () => {
	it('SELECT_SCHEME switches scheme and resets current color to its first color', () => {
		const state = baseState({ currentColor: '#abcdef' })
		const next = appReducer(state, {
			type: 'SELECT_SCHEME',
			scheme: colorSchemes[3],
		})
		expect(next.currentScheme).toBe(colorSchemes[3])
		expect(next.currentColor).toBe(colorSchemes[3].colors[0])
	})

	it('SELECT_SCHEME remaps painted groups with an old-scheme color to the new scheme color at the same position', () => {
		const oldScheme = colorSchemes[0]
		const newScheme = colorSchemes[1]
		const state = baseState({
			currentScheme: oldScheme,
			shapeGroupColors: {
				a: oldScheme.colors[0],
				b: oldScheme.colors[2],
			},
		})
		const next = appReducer(state, {
			type: 'SELECT_SCHEME',
			scheme: newScheme,
		})
		expect(next.shapeGroupColors).toEqual({
			a: newScheme.colors[0],
			b: newScheme.colors[2],
		})
	})

	it('SELECT_SCHEME leaves painted groups with base/accent (or any non-scheme color) untouched', () => {
		const oldScheme = colorSchemes[0]
		const newScheme = colorSchemes[1]
		const state = baseState({
			currentScheme: oldScheme,
			shapeGroupColors: { a: '#222222', b: '#ffffff' },
		})
		const next = appReducer(state, {
			type: 'SELECT_SCHEME',
			scheme: newScheme,
		})
		expect(next.shapeGroupColors).toEqual({ a: '#222222', b: '#ffffff' })
	})

	it('SELECT_COLOR sets the current color directly', () => {
		const state = baseState()
		const next = appReducer(state, {
			type: 'SELECT_COLOR',
			color: '#123456',
		})
		expect(next.currentColor).toBe('#123456')
	})

	it('PAINT_SHAPE_GROUP paints an unpainted group with the current color', () => {
		const state = baseState({ currentColor: '#ff0000' })
		const next = appReducer(state, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: '0,0',
		})
		expect(next.shapeGroupColors['0,0']).toBe('#ff0000')
	})

	it('PAINT_SHAPE_GROUP toggles back to the accent color when clicking an already-painted group with the same color', () => {
		const state = baseState({
			currentColor: '#ff0000',
			shapeGroupColors: { '0,0': '#ff0000' },
		})
		const next = appReducer(state, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: '0,0',
		})
		expect(next.shapeGroupColors['0,0']).toBe('#222222')
	})

	it('PAINT_SHAPE_GROUP repaints (not toggles) a group painted a different color', () => {
		const state = baseState({
			currentColor: '#00ff00',
			shapeGroupColors: { '0,0': '#ff0000' },
		})
		const next = appReducer(state, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: '0,0',
		})
		expect(next.shapeGroupColors['0,0']).toBe('#00ff00')
	})

	it('TOGGLE_DARK_MODE flips the darkMode flag', () => {
		const state = baseState({ darkMode: false })
		expect(appReducer(state, { type: 'TOGGLE_DARK_MODE' }).darkMode).toBe(
			true,
		)
	})

	it('TOGGLE_DARK_MODE flips painted groups with the old base/accent to the new ones', () => {
		const state = baseState({
			darkMode: false,
			shapeGroupColors: { a: '#222222', b: '#ffffff', c: '#ff0000' },
		})
		const next = appReducer(state, { type: 'TOGGLE_DARK_MODE' })
		expect(next.shapeGroupColors).toEqual({
			a: '#ffffff',
			b: '#222222',
			c: '#ff0000',
		})
	})

	it('RESET_DESIGN clears all painted groups', () => {
		const state = baseState({
			shapeGroupColors: { a: '#ff0000', b: '#00ff00' },
		})
		const next = appReducer(state, { type: 'RESET_DESIGN' })
		expect(next.shapeGroupColors).toEqual({})
	})

	it('RANDOMIZE_DESIGN assigns every group id a color from the current scheme or theme base (never accent)', () => {
		const state = baseState({ darkMode: false })
		const next = appReducer(state, { type: 'RANDOMIZE_DESIGN' })
		const possible = new Set([
			...state.currentScheme.colors,
			'#ffffff', // light-mode base
		])
		const groupIds = Object.keys(next.shapeGroupColors)
		expect(groupIds.length).toBeGreaterThan(0)
		for (const color of Object.values(next.shapeGroupColors)) {
			expect(possible).toContain(color)
		}
	})

	it('RANDOMIZE_DESIGN replaces the entire design, discarding any previously painted groups', () => {
		const state = baseState({
			shapeGroupColors: { 'not-a-real-group-id': '#ff0000' },
		})
		const next = appReducer(state, { type: 'RANDOMIZE_DESIGN' })
		expect(next.shapeGroupColors['not-a-real-group-id']).toBeUndefined()
	})

	it('TOGGLE_EDITABLE_AREA flips the showEditableArea flag', () => {
		const state = baseState({ showEditableArea: true })
		expect(
			appReducer(state, { type: 'TOGGLE_EDITABLE_AREA' })
				.showEditableArea,
		).toBe(false)
		expect(
			appReducer(baseState({ showEditableArea: false }), {
				type: 'TOGGLE_EDITABLE_AREA',
			}).showEditableArea,
		).toBe(true)
	})

	it('SELECT_GRID_SHAPE switches shape and resets shapeGroupColors', () => {
		const state = baseState({
			gridShape: 'hexagon',
			shapeGroupColors: { '0,0': '#ff0000' },
		})
		const next = appReducer(state, {
			type: 'SELECT_GRID_SHAPE',
			shape: 'triangle',
		})
		expect(next.gridShape).toBe('triangle')
		expect(next.shapeGroupColors).toEqual({})
	})

	it('SELECT_GRID_SHAPE is a no-op (same state reference) when selecting the already-current shape', () => {
		const state = baseState({
			gridShape: 'hexagon',
			shapeGroupColors: { '0,0': '#ff0000' },
		})
		const next = appReducer(state, {
			type: 'SELECT_GRID_SHAPE',
			shape: 'hexagon',
		})
		expect(next).toBe(state)
	})
})
