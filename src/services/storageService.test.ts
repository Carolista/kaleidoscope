import { beforeEach, describe, expect, it, vi } from 'vitest'
import { colorSchemes } from '../data/colorSchemes'
import { supportedGridShapes } from '../data/gridShapes'
import type { AppState } from '../types/appState'
import {
	loadInitialAppState,
	savePersistedState,
	hasPersistedDesign,
} from './storageService'

const STORAGE_KEY = 'kaleidoscope:design'

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

describe('storageService', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('loadInitialAppState falls back to a fresh random state when nothing is saved', () => {
		const state = loadInitialAppState()
		expect(colorSchemes).toContain(state.currentScheme)
		expect(state.shapeGroupColors).toEqual({})
	})

	it('round-trips a saved design back through loadInitialAppState', () => {
		const saved = baseState({
			currentScheme: colorSchemes[2],
			currentColor: colorSchemes[2].colors[1],
			darkMode: true,
			gridShape: 'triangle',
			shapeGroupColors: { '0,0': colorSchemes[2].colors[1] },
		})
		savePersistedState(saved)

		const loaded = loadInitialAppState()
		expect(loaded).toEqual(saved)
	})

	it.each(supportedGridShapes)('restores supported shape $id', ({ id }) => {
		const saved = baseState({ gridShape: id })
		savePersistedState(saved)
		expect(loadInitialAppState()).toEqual(saved)
	})

	it.each(['#000000', '#ffffff', '#ABCDEF', '#aB12Cd'])(
		'preserves valid six-digit hex color %s without normalization or palette restrictions',
		color => {
			const saved = baseState({
				currentColor: color,
				shapeGroupColors: { 'historical-group-id': color },
			})
			savePersistedState(saved)
			expect(loadInitialAppState()).toEqual(saved)
		},
	)

	it.each([
		undefined,
		null,
		123,
		{},
		[],
		'',
		'red',
		'transparent',
		'#abc',
		'#abcd',
		'#12345678',
		'123456',
		'#12345g',
		' #123456',
		'#123456 ',
		'#123456\n',
		'rgb(1, 2, 3)',
		'url(#paint)',
	])('rejects invalid selected or painted color %j', color => {
		for (const overrides of [
			{ currentColor: color },
			{ shapeGroupColors: { valid: '#123456', invalid: color } },
		]) {
			// JSON omits undefined properties, so a missing paint value cannot be invalid.
			if (color === undefined && 'shapeGroupColors' in overrides) continue
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					version: 1,
					schemeName: colorSchemes[0].name,
					currentColor: '#123456',
					darkMode: false,
					showEditableArea: false,
					gridShape: 'triangle',
					shapeGroupColors: { valid: '#123456' },
					...overrides,
				}),
			)
			const state = loadInitialAppState()
			expect(state).toEqual({
				currentScheme: state.currentScheme,
				currentColor: state.currentScheme.colors[0],
				darkMode: true,
				showEditableArea: true,
				gridShape: 'hexagon',
				shapeGroupColors: {},
			})
			expect(colorSchemes).toContain(state.currentScheme)
		}
	})

	it.each([
		undefined,
		null,
		[],
		['#123456'],
		['#123456', '#abcdef'],
		123,
		'#123456',
	])('rejects malformed paint map %j', shapeGroupColors => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: colorSchemes[0].name,
				currentColor: '#123456',
				darkMode: false,
				shapeGroupColors,
			}),
		)
		const state = loadInitialAppState()
		expect(state.darkMode).toBe(true)
		expect(state.currentColor).toBe(state.currentScheme.colors[0])
		expect(state.shapeGroupColors).toEqual({})
	})

	it.each([null, [], ['#123456'], 123, 'design'])(
		'rejects non-record payload %j without changing the saved-key existence policy',
		payload => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
			expect(loadInitialAppState().shapeGroupColors).toEqual({})
			expect(hasPersistedDesign()).toBe(true)
		},
	)

	it('restores historical designs with both optional fields missing and valid painted colors', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: colorSchemes[0].name,
				currentColor: '#ABCDEF',
				darkMode: false,
				shapeGroupColors: { a: '#123456' },
			}),
		)
		expect(loadInitialAppState()).toEqual(
			baseState({
				currentColor: '#ABCDEF',
				shapeGroupColors: { a: '#123456' },
			}),
		)
	})

	it('falls back to a fresh random state when the saved scheme name no longer exists', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: 'Not A Real Scheme',
				currentColor: '#123456',
				darkMode: true,
				shapeGroupColors: {},
			}),
		)
		const state = loadInitialAppState()
		expect(colorSchemes).toContain(state.currentScheme)
	})

	it('falls back to a fresh random state on corrupted JSON', () => {
		localStorage.setItem(STORAGE_KEY, '{ not valid json')
		const state = loadInitialAppState()
		expect(colorSchemes).toContain(state.currentScheme)
	})

	it('falls back to a fresh random state when the saved version is unrecognized', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 999,
				schemeName: colorSchemes[0].name,
				currentColor: colorSchemes[0].colors[0],
				darkMode: false,
				shapeGroupColors: {},
			}),
		)
		const state = loadInitialAppState()
		expect(colorSchemes).toContain(state.currentScheme)
	})

	it('falls back to a fresh random state when shapeGroupColors has non-string values', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: colorSchemes[0].name,
				currentColor: colorSchemes[0].colors[0],
				darkMode: false,
				shapeGroupColors: { a: 123 },
			}),
		)
		const state = loadInitialAppState()
		expect(colorSchemes).toContain(state.currentScheme)
		expect(state.shapeGroupColors).toEqual({})
	})

	it('defaults showEditableArea to true when loading a design saved before that field existed', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: colorSchemes[0].name,
				currentColor: colorSchemes[0].colors[0],
				darkMode: false,
				shapeGroupColors: {},
			}),
		)
		const state = loadInitialAppState()
		expect(state.showEditableArea).toBe(true)
	})

	it('falls back to a fresh random state when showEditableArea is present but not a boolean', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: colorSchemes[0].name,
				currentColor: colorSchemes[0].colors[0],
				darkMode: false,
				showEditableArea: 'yes',
				shapeGroupColors: {},
			}),
		)
		const state = loadInitialAppState()
		expect(colorSchemes).toContain(state.currentScheme)
	})

	it('defaults gridShape to hexagon when loading a design saved before that field existed', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: colorSchemes[0].name,
				currentColor: colorSchemes[0].colors[0],
				darkMode: false,
				shapeGroupColors: {},
			}),
		)
		const state = loadInitialAppState()
		expect(state.gridShape).toBe('hexagon')
	})

	it('falls back to a fresh random state when gridShape is present but not a recognized shape', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: colorSchemes[0].name,
				currentColor: colorSchemes[0].colors[0],
				darkMode: false,
				gridShape: 'octagon',
				shapeGroupColors: {},
			}),
		)
		const state = loadInitialAppState()
		expect(colorSchemes).toContain(state.currentScheme)
	})

	it('savePersistedState swallows storage errors instead of throwing', () => {
		const setItemSpy = vi
			.spyOn(Storage.prototype, 'setItem')
			.mockImplementation(() => {
				throw new Error('quota exceeded')
			})
		expect(() => savePersistedState(baseState())).not.toThrow()
		setItemSpy.mockRestore()
	})

	it('loadInitialAppState swallows storage access errors instead of throwing', () => {
		const getItemSpy = vi
			.spyOn(Storage.prototype, 'getItem')
			.mockImplementation(() => {
				throw new Error('storage disabled')
			})
		expect(() => loadInitialAppState()).not.toThrow()
		getItemSpy.mockRestore()
	})

	it('hasPersistedDesign is false when nothing has been saved', () => {
		expect(hasPersistedDesign()).toBe(false)
	})

	it('hasPersistedDesign is true once a design has been saved', () => {
		savePersistedState(baseState())
		expect(hasPersistedDesign()).toBe(true)
	})

	it('hasPersistedDesign swallows storage access errors instead of throwing', () => {
		const getItemSpy = vi
			.spyOn(Storage.prototype, 'getItem')
			.mockImplementation(() => {
				throw new Error('storage disabled')
			})
		expect(() => hasPersistedDesign()).not.toThrow()
		expect(hasPersistedDesign()).toBe(false)
		getItemSpy.mockRestore()
	})
})
