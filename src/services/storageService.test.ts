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
