import { beforeEach, describe, expect, it, vi } from 'vitest'
import { colorSchemes } from '../data/colorSchemes'
import { supportedGridShapes } from '../data/gridShapes'
import { defaultGridSizes } from '../data/gridSizes'
import { legacyGridSizes } from '../data/gridSizes'
import type { AppState } from '../types/appState'
import { appReducer } from '../state/appReducer'
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
		gridSizes: { ...defaultGridSizes },
		savedBoards: {},
		shapeGroupColors: {},
		...overrides,
	}
}

describe('storageService', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('round-trips all 18 boards and restores each board after reload', () => {
		let saved = baseState()
		const boards = supportedGridShapes.flatMap(({ id }) =>
			(['sm', 'md', 'lg'] as const).map(size => ({ shape: id, size })),
		)
		boards.forEach(({ shape, size }, index) => {
			saved = appReducer(saved, {
				type: 'SELECT_GRID_SHAPE',
				shape,
				size,
			})
			saved = appReducer(saved, {
				type: 'SELECT_COLOR',
				color: `#${index.toString(16).padStart(6, '0')}`,
			})
			saved = appReducer(saved, {
				type: 'PAINT_SHAPE_GROUP',
				groupId: '0',
			})
		})
		savePersistedState(saved)
		let restored = loadInitialAppState()
		expect(restored).toEqual(saved)
		boards.forEach(({ shape, size }, index) => {
			restored = appReducer(restored, {
				type: 'SELECT_GRID_SHAPE',
				shape,
				size,
			})
			expect(restored.shapeGroupColors).toEqual({
				'0': `#${index.toString(16).padStart(6, '0')}`,
			})
		})
	})

	it.each([1, 2, 3, 4])(
		'migrates version %s active paint without copying it to other boards',
		version => {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					version,
					schemeName: colorSchemes[0].name,
					currentColor: '#123456',
					darkMode: false,
					gridShape: 'triangle',
					gridSizes: { ...defaultGridSizes, triangle: 'sm' },
					shapeGroupColors: { '0': '#123456' },
				}),
			)
			const restored = loadInitialAppState()
			expect(restored.shapeGroupColors).toEqual({ '0': '#123456' })
			expect(restored.savedBoards).toEqual({})
			const switched = appReducer(restored, {
				type: 'SELECT_GRID_SIZE',
				shape: 'triangle',
				size: 'md',
			})
			expect(switched.shapeGroupColors).toEqual({})
			expect(switched.savedBoards['triangle:sm']).toEqual({
				'0': '#123456',
			})
		},
	)

	it.each([
		null,
		[],
		{ 'unknown:sm': {} },
		{ 'triangle:xl': {} },
		{ 'triangle:sm': [] },
		{ 'triangle:sm': { a: 'red' } },
		{ 'hexagon:md': {} },
	])('rejects invalid version-5 inactive boards %j', savedBoards => {
		savePersistedState(baseState())
		const payload = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
		payload.savedBoards = savedBoards
		localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
		expect(loadInitialAppState().savedBoards).toEqual({})
		expect(loadInitialAppState().darkMode).toBe(true)
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
				gridSizes: { ...defaultGridSizes },
				savedBoards: {},
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
				gridSizes: { ...defaultGridSizes, hexagon: 'lg' },
				shapeGroupColors: { a: '#123456' },
			}),
		)
	})

	it('round-trips per-shape grid sizes and migrates old saved designs to their previous active size', () => {
		const saved = baseState({
			gridSizes: {
				...defaultGridSizes,
				hexagon: 'lg',
				hexagram: 'md',
			},
		})
		savePersistedState(saved)
		expect(loadInitialAppState()).toEqual(saved)

		const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<
			string,
			unknown
		>
		delete legacy.gridSizes
		legacy.version = 4
		legacy.gridShape = 'triangle'
		localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))
		expect(loadInitialAppState().gridSizes).toEqual({
			...defaultGridSizes,
			triangle: legacyGridSizes.triangle,
		})
	})

	it('migrates pre-Hexagram-size saved MD values to LG to preserve the old rendered size', () => {
		const previouslySaved = baseState({
			gridSizes: { ...defaultGridSizes, hexagram: 'md' },
		})
		savePersistedState(previouslySaved)
		const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<
			string,
			unknown
		>
		legacy.version = 1
		localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))

		expect(loadInitialAppState().gridSizes.hexagram).toBe('lg')
	})

	it.each([{ hexagon: 'extra-large' }, { pinwheel: 'xl' }])(
		'rejects invalid or unavailable persisted grid sizes',
		gridSizes => {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					version: 1,
					schemeName: colorSchemes[0].name,
					currentColor: '#123456',
					darkMode: false,
					gridSizes,
					shapeGroupColors: {},
				}),
			)
			expect(loadInitialAppState().gridSizes).toEqual(defaultGridSizes)
		},
	)

	it('migrates pre-Circle-Rings-size MD values to LG to preserve the previous grid', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 2,
				schemeName: colorSchemes[0].name,
				currentColor: '#123456',
				darkMode: false,
				gridShape: 'circleRings',
				gridSizes: { ...defaultGridSizes, circleRings: 'md' },
				shapeGroupColors: {},
			}),
		)

		expect(loadInitialAppState().gridSizes.circleRings).toBe('lg')
	})

	it('migrates pre-Pinwheel-size MD values to LG to preserve the previous grid', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 3,
				schemeName: colorSchemes[0].name,
				currentColor: '#123456',
				darkMode: false,
				gridShape: 'pinwheel',
				gridSizes: { ...defaultGridSizes, pinwheel: 'md' },
				shapeGroupColors: {},
			}),
		)

		expect(loadInitialAppState().gridSizes.pinwheel).toBe('lg')
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
